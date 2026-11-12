import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_STATE } from "@/types/domain";
import { buildStateChanges, recordIdentity, stableSerialize } from "@/services/sync-records";

describe("sync record changes", () => {
  it("keeps identity stable when object property order differs", () => {
    expect(stableSerialize({ b: 2, a: 1 })).toBe(stableSerialize({ a: 1, b: 2 }));
  });

  it("emits atomic operations for additions, updates and removals", () => {
    const previous = {
      ...DEFAULT_STATE,
      books: [{ id: "book-1", title: "Old", totalPages: 100, currentPage: 1, createdAt: "now", updatedAt: "now" }],
      words: [{ normalized: "read", term: "read", lookups: 1 }],
    };
    const next = {
      ...DEFAULT_STATE,
      books: [{ ...previous.books[0], title: "New" }],
      words: [{ normalized: "learn", term: "learn", lookups: 2 }],
    };
    const changes = buildStateChanges(previous, next, DEFAULT_SETTINGS, DEFAULT_SETTINGS);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "upsert", kind: "book", record_id: "book-1" }),
      expect.objectContaining({ operation: "delete_word", normalized: "read" }),
      expect.objectContaining({ operation: "upsert", kind: "word", record_id: "learn" }),
    ]));
  });

  it("uses normalized word identity", () => {
    expect(recordIdentity("word", { term: " READ ", normalized: "READ" }, 9)).toBe("read");
  });
});
