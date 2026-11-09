import { AppState, DEFAULT_STATE, UserSettings } from "@/types/domain";
import { supabase } from "@/lib/supabase/client";

const RECORDS = "wordtrail_records";
const LEGACY = "wordtrail_user_data";
type RecordKind = "book" | "session" | "word" | "review" | "settings";
type CloudRecord = { kind: RecordKind; record_id: string; data: unknown; updated_at: string };

function idFor(kind: RecordKind, item: { id?: string; at?: string; term?: string; mode?: string }, index: number) {
  return item.id || (kind === "review" ? `${item.at || "review"}-${item.term || index}-${item.mode || ""}` : `${kind}-${index}`);
}

export async function loadCloudData(userId: string) {
  if (!supabase) return null;
  const { data: rows, error } = await supabase.from(RECORDS).select("kind, record_id, data, updated_at").eq("user_id", userId);
  if (error) throw error;
  if (!rows?.length) {
    const legacy = await supabase.from(LEGACY).select("data").eq("user_id", userId).maybeSingle();
    if (legacy.error) throw legacy.error;
    const old = legacy.data?.data as { state?: AppState; settings?: UserSettings } | null;
    if (!old) return { state: structuredClone(DEFAULT_STATE), settings: { dailyGoal: 30, theme: "system" as const } };
    await seedCloudData(userId, old.state || DEFAULT_STATE, old.settings || { dailyGoal: 30, theme: "system" });
    return { state: { ...structuredClone(DEFAULT_STATE), ...(old.state || {}), books: old.state?.books || [] }, settings: old.settings || { dailyGoal: 30, theme: "system" } };
  }
  const state = structuredClone(DEFAULT_STATE);
  const settings: UserSettings = { dailyGoal: 30, theme: "system" };
  for (const row of rows as CloudRecord[]) {
    if (row.kind === "book") state.books.push(row.data as AppState["books"][number]);
    if (row.kind === "session") state.readingSessions.push(row.data as AppState["readingSessions"][number]);
    if (row.kind === "word") state.words.push(row.data as AppState["words"][number]);
    if (row.kind === "review") state.reviews.push(row.data as AppState["reviews"][number]);
    if (row.kind === "settings") Object.assign(settings, row.data);
  }
  return { state, settings };
}

async function seedCloudData(userId: string, state: AppState, settings: UserSettings) {
  if (!supabase) return;
  const rows = [
    ...state.books.map((data, index) => ({ user_id: userId, kind: "book" as const, record_id: idFor("book", data, index), data })),
    ...state.readingSessions.map((data, index) => ({ user_id: userId, kind: "session" as const, record_id: idFor("session", data, index), data })),
    ...state.words.map((data, index) => ({ user_id: userId, kind: "word" as const, record_id: idFor("word", data, index), data })),
    ...state.reviews.map((data, index) => ({ user_id: userId, kind: "review" as const, record_id: idFor("review", data, index), data })),
    { user_id: userId, kind: "settings" as const, record_id: "settings", data: settings },
  ];
  if (rows.length) {
    const { error } = await supabase.from(RECORDS).upsert(rows, { onConflict: "user_id,kind,record_id" });
    if (error) throw error;
  }
}

export async function persistStateDiff(userId: string, previous: AppState, next: AppState, previousSettings: UserSettings, nextSettings: UserSettings) {
  if (!supabase) return;
  const operations: Promise<unknown>[] = [];
  const syncCollection = (kind: RecordKind, before: { id?: string; at?: string; term?: string; mode?: string }[], after: { id?: string; at?: string; term?: string; mode?: string }[]) => {
    const beforeMap = new Map(before.map((item, index) => [idFor(kind, item, index), item]));
    const afterMap = new Map(after.map((item, index) => [idFor(kind, item, index), item]));
    for (const [recordId] of beforeMap) if (!afterMap.has(recordId)) operations.push((async () => await supabase!.from(RECORDS).delete().eq("user_id", userId).eq("kind", kind).eq("record_id", recordId))());
    for (const [recordId, item] of afterMap) if (JSON.stringify(beforeMap.get(recordId)) !== JSON.stringify(item)) operations.push((async () => await supabase!.from(RECORDS).upsert({ user_id: userId, kind, record_id: recordId, data: item }, { onConflict: "user_id,kind,record_id" }))());
  };
  syncCollection("book", previous.books, next.books);
  syncCollection("session", previous.readingSessions, next.readingSessions);
  syncCollection("word", previous.words, next.words);
  syncCollection("review", previous.reviews, next.reviews);
  if (JSON.stringify(previousSettings) !== JSON.stringify(nextSettings)) operations.push((async () => await supabase!.from(RECORDS).upsert({ user_id: userId, kind: "settings", record_id: "settings", data: nextSettings }, { onConflict: "user_id,kind,record_id" }))());
  const results = await Promise.all(operations);
  const failed = results.find((result) => (result as { error?: unknown })?.error);
  if (failed) throw (failed as { error: unknown }).error;
}
