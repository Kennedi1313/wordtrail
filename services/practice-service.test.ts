import { describe, expect, it } from "vitest";
import {
  practiceWords,
  quizOptions,
  updateReview,
} from "@/services/practice-service";
import { Word } from "@/types/domain";

const words: Word[] = [
  {
    term: "bright",
    normalized: "bright",
    definition: "giving out light",
    lookups: 1,
  },
  {
    term: "quiet",
    normalized: "quiet",
    definition: "making little noise",
    lookups: 1,
  },
];

describe("practice domain", () => {
  it("filters words without definitions", () =>
    expect(
      practiceWords([
        ...words,
        { term: "missing", normalized: "missing", lookups: 1 },
      ]),
    ).toHaveLength(2));
  it("includes the correct answer in quiz options", () =>
    expect(
      quizOptions(words[0], words).some(
        (option) => option.correct && option.value === "bright",
      ),
    ).toBe(true));
  it("increases the interval after a correct answer", () =>
    expect(updateReview(words[0], true).dueAt).toBeTruthy());
  it("reschedules incorrect answers soon", () =>
    expect(
      new Date(updateReview(words[0], false).dueAt!).getTime(),
    ).toBeGreaterThan(Date.now()));
});
