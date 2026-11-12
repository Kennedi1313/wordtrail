import { describe, expect, it } from "vitest";
import { isDictionaryTerm, parsePracticeCount } from "@/lib/api/request-validation";

describe("dictionary route validation", () => {
  it("defaults and clamps practice batch counts", () => {
    expect(parsePracticeCount(null)).toBe(20);
    expect(parsePracticeCount("abc")).toBe(20);
    expect(parsePracticeCount("0")).toBe(1);
    expect(parsePracticeCount("4.8")).toBe(4);
    expect(parsePracticeCount("200")).toBe(20);
  });

  it("accepts bounded dictionary terms only", () => {
    expect(isDictionaryTerm("enticed")).toBe(true);
    expect(isDictionaryTerm("can't")).toBe(true);
    expect(isDictionaryTerm("word word")).toBe(false);
    expect(isDictionaryTerm("x".repeat(65))).toBe(false);
  });
});
