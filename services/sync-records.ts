import { AppState, UserSettings } from "@/types/domain";

export type RecordKind = "book" | "session" | "word" | "review" | "active_session" | "settings";
type Identifiable = { id?: string; at?: string; term?: string; normalized?: string; mode?: string };
type Change = Record<string, unknown>;

export function recordIdentity(kind: RecordKind, item: Identifiable, index: number) {
  if (kind === "word") return (item.normalized || item.term || `word-${index}`).trim().toLowerCase();
  return item.id || (kind === "review" ? `${item.at || "review"}-${item.term || index}-${item.mode || ""}` : `${kind}-${index}`);
}

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export function buildStateChanges(
  previous: AppState,
  next: AppState,
  previousSettings: UserSettings,
  nextSettings: UserSettings,
): Change[] {
  const changes: Change[] = [];
  const syncCollection = (kind: RecordKind, before: Identifiable[], after: Identifiable[]) => {
    const beforeMap = new Map(before.map((item, index) => [recordIdentity(kind, item, index), item]));
    const afterMap = new Map(after.map((item, index) => [recordIdentity(kind, item, index), item]));
    for (const [recordId, item] of beforeMap) {
      if (afterMap.has(recordId)) continue;
      changes.push(kind === "word"
        ? { operation: "delete_word", normalized: (item.normalized || item.term || "").trim().toLowerCase() }
        : { operation: "delete", kind, record_id: recordId });
    }
    for (const [recordId, item] of afterMap) {
      if (stableSerialize(beforeMap.get(recordId)) === stableSerialize(item)) continue;
      changes.push({
        operation: "upsert",
        kind,
        record_id: recordId,
        data: kind === "word" ? { ...item, lookupAggregateVersion: 1 } : item,
      });
    }
  };
  syncCollection("book", previous.books, next.books);
  syncCollection("session", previous.readingSessions, next.readingSessions);
  syncCollection("word", previous.words, next.words);
  syncCollection("review", previous.reviews, next.reviews);
  if (stableSerialize(previous.activeReadingSession) !== stableSerialize(next.activeReadingSession)) {
    changes.push(next.activeReadingSession
      ? { operation: "upsert", kind: "active_session", record_id: "active", data: next.activeReadingSession }
      : { operation: "delete", kind: "active_session", record_id: "active" });
  }
  if (stableSerialize(previousSettings) !== stableSerialize(nextSettings)) {
    changes.push({ operation: "upsert", kind: "settings", record_id: "settings", data: nextSettings });
  }
  return changes;
}
