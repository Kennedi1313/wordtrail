import { describe, expect, it } from "vitest";
import { mergeWordRecords } from "@/services/word-record-merge";

describe("mergeWordRecords", () => {
  it("combines lookup counts for legacy rows of the same word", () => {
    const words = mergeWordRecords([
      { record_id: "word-2", data: { term: "enticed", normalized: "enticed", definition: "tempted", lookups: 2 } },
      { record_id: "word-8", data: { term: "Enticed", normalized: "enticed", lookups: 3 } },
    ]);

    expect(words).toHaveLength(1);
    expect(words[0].lookups).toBe(5);
    expect(words[0].definition).toBe("tempted");
    expect(words[0].lookupAggregateVersion).toBe(1);
  });

  it("does not add legacy rows again after an aggregate was saved", () => {
    const words = mergeWordRecords([
      { record_id: "enticed", data: { term: "enticed", normalized: "enticed", lookups: 5, lookupAggregateVersion: 1 } },
      { record_id: "word-2", data: { term: "enticed", normalized: "enticed", lookups: 2 } },
    ]);

    expect(words[0].lookups).toBe(5);
  });
});
