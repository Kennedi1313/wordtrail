import { AppState, DEFAULT_STATE, UserSettings } from "@/types/domain";
import { supabase } from "@/lib/supabase/client";
import { mergeWordRecords } from "@/services/word-record-merge";
import { buildStateChanges, recordIdentity, RecordKind } from "@/services/sync-records";

const RECORDS = "wordtrail_records";
const LEGACY = "wordtrail_user_data";
type CloudRecord = { kind: RecordKind; record_id: string; data: unknown; updated_at: string };

export async function loadCloudData(userId: string, attempt = 0) {
  if (!supabase) return null;
  const { data: versionRow, error: versionError } = await supabase
    .from("wordtrail_sync_versions")
    .select("version")
    .eq("user_id", userId)
    .maybeSingle();
  if (versionError) throw versionError;
  const version = Number(versionRow?.version || 0);
  const { data: rows, error } = await supabase.from(RECORDS).select("kind, record_id, data, updated_at").eq("user_id", userId);
  if (error) throw error;
  if (!rows?.length) {
    // An incremented version proves the account has already moved to record-based storage.
    // The legacy snapshot may contain deleted data and must never be imported again.
    if (version > 0) {
      return { state: structuredClone(DEFAULT_STATE), settings: { dailyGoal: 30, theme: "system" as const }, version };
    }
    const legacy = await supabase.from(LEGACY).select("data").eq("user_id", userId).maybeSingle();
    if (legacy.error) throw legacy.error;
    const old = legacy.data?.data as { state?: AppState; settings?: UserSettings } | null;
    if (!old) {
      const confirmedVersion = await readSyncVersion(userId);
      if (confirmedVersion !== version) {
        if (attempt >= 3) throw new Error("Os dados mudaram em outra sessão. Recarregue a página.");
        return loadCloudData(userId, attempt + 1);
      }
      return { state: structuredClone(DEFAULT_STATE), settings: { dailyGoal: 30, theme: "system" as const }, version };
    }
    let seededVersion: number;
    try {
      seededVersion = await seedCloudData(old.state || DEFAULT_STATE, old.settings || { dailyGoal: 30, theme: "system" }, version);
    } catch (error) {
      if ((error as { code?: string })?.code === "40001") {
        if (attempt >= 3) throw new Error("Os dados mudaram em outra sessão. Recarregue a página.");
        return loadCloudData(userId, attempt + 1);
      }
      throw error;
    }
    const migratedState = { ...structuredClone(DEFAULT_STATE), ...(old.state || {}), books: old.state?.books || [] };
    migratedState.words = mergeWordRecords(
      (old.state?.words || []).map((word, index) => ({
        record_id: recordIdentity("word", word, index),
        data: word,
      })),
    );
    return { state: migratedState, settings: old.settings || { dailyGoal: 30, theme: "system" }, version: seededVersion };
  }
  const state = structuredClone(DEFAULT_STATE);
  const settings: UserSettings = { dailyGoal: 30, theme: "system" };
  const wordRows: CloudRecord[] = [];
  for (const row of rows as CloudRecord[]) {
    if (row.kind === "book") state.books.push(row.data as AppState["books"][number]);
    if (row.kind === "session") state.readingSessions.push(row.data as AppState["readingSessions"][number]);
    if (row.kind === "word") wordRows.push(row);
    if (row.kind === "review") state.reviews.push(row.data as AppState["reviews"][number]);
    if (row.kind === "active_session") state.activeReadingSession = row.data as AppState["activeReadingSession"];
    if (row.kind === "settings") Object.assign(settings, row.data);
  }
  state.words = mergeWordRecords(
    wordRows.map((row) => ({ record_id: row.record_id, data: row.data as AppState["words"][number] })),
  );
  const confirmedVersion = await readSyncVersion(userId);
  if (confirmedVersion !== version) {
    if (attempt >= 3) throw new Error("Os dados mudaram em outra sessão. Recarregue a página.");
    return loadCloudData(userId, attempt + 1);
  }
  return { state, settings, version };
}

async function readSyncVersion(userId: string) {
  if (!supabase) throw new Error("O servidor não está disponível.");
  const { data, error } = await supabase.from("wordtrail_sync_versions").select("version").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Number(data?.version || 0);
}

async function seedCloudData(state: AppState, settings: UserSettings, expectedVersion: number) {
  if (!supabase) throw new Error("O servidor não está disponível.");
  const words = new Map<string, AppState["words"][number]>();
  for (const word of state.words) {
    const key = recordIdentity("word", word, 0);
    const previous = words.get(key);
    words.set(key, previous
      ? { ...previous, ...word, definition: word.definition || previous.definition, lookups: (previous.lookups || 0) + (word.lookups || 0), lookupAggregateVersion: 1 }
      : { ...word, lookupAggregateVersion: 1 });
  }
  const changes = [
    ...state.books.map((data, index) => ({ operation: "upsert", kind: "book", record_id: recordIdentity("book", data, index), data })),
    ...state.readingSessions.map((data, index) => ({ operation: "upsert", kind: "session", record_id: recordIdentity("session", data, index), data })),
    ...[...words].map(([record_id, data]) => ({ operation: "upsert", kind: "word", record_id, data })),
    ...state.reviews.map((data, index) => ({ operation: "upsert", kind: "review", record_id: recordIdentity("review", data, index), data })),
    ...(state.activeReadingSession ? [{ operation: "upsert", kind: "active_session", record_id: "active", data: state.activeReadingSession }] : []),
    { operation: "upsert", kind: "settings", record_id: "settings", data: settings },
  ];
  const { data, error } = await supabase.rpc("apply_wordtrail_record_changes", { changes, expected_version: expectedVersion });
  if (error) throw error;
  return Number(data);
}

export async function persistStateDiff(previous: AppState, next: AppState, previousSettings: UserSettings, nextSettings: UserSettings, expectedVersion: number) {
  if (!supabase) throw new Error("O servidor não está disponível.");
  const changes = buildStateChanges(previous, next, previousSettings, nextSettings);
  if (!changes.length) return expectedVersion;
  const { data, error } = await supabase.rpc("apply_wordtrail_record_changes", {
    changes, expected_version: expectedVersion,
  });
  if (error) throw error;
  return Number(data);
}
