import { Word } from "@/types/domain";

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function practiceWords(words: Word[]) {
  return words.filter((word) => word.definition?.trim());
}
export function quizWords(words: Word[]) {
  return practiceWords(words);
}
export function quizOptions(word: Word, words: Word[]) {
  const distractors = shuffle(
    quizWords(words).filter((item) => item.normalized !== word.normalized),
  )
    .slice(0, 3)
    .map((item) => ({ value: item.term, correct: false }));
  return shuffle([{ value: word.term, correct: true }, ...distractors]);
}
export function updateReview(word: Word, correct: boolean) {
  if (correct) {
    const intervalDays = word.intervalDays
      ? Math.min(60, Math.round(word.intervalDays * 2))
      : 1;
    return {
      ...word,
      correctStreak: (word.correctStreak || 0) + 1,
      intervalDays,
      dueAt: new Date(Date.now() + intervalDays * 86400000).toISOString(),
    };
  }
  return {
    ...word,
    correctStreak: 0,
    intervalDays: 0,
    dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}
