export type Word = {
  id?: string;
  term: string;
  normalized: string;
  definition?: string;
  definitionSource?: string;
  partOfSpeech?: string;
  translation?: string;
  translationOptions?: string[];
  phonetic?: string;
  audio?: string;
  lookups: number;
  firstSearchedAt?: string;
  lastSearchedAt?: string;
  createdAt?: string;
  dueAt?: string;
  intervalDays?: number;
  correctStreak?: number;
};

export type ReadingSession = {
  id: string;
  title?: string;
  pages: number;
  note?: string;
  startedAt: string;
  endedAt?: string;
  seconds: number;
  lookups: ReadingLookup[];
  active?: boolean;
  pausedAt?: string;
  date?: string;
  durationSeconds?: number;
  minutes?: number;
  createdAt?: string;
  wordSnapshots?: Record<string, Word | null>;
  pendingWords?: Record<string, Word>;
};

export type ReadingLookup = {
  at: string;
  term: string;
  normalized: string;
  translation?: string;
  wasKnown?: boolean;
};

export type Review = {
  at: string;
  term: string;
  mode: string;
  correct: boolean;
};
export type UserSettings = { dailyGoal: number };
export type AppState = {
  words: Word[];
  readingSessions: ReadingSession[];
  reviews: Review[];
  activeReadingSession: ReadingSession | null;
};

export const DEFAULT_STATE: AppState = {
  words: [],
  readingSessions: [],
  reviews: [],
  activeReadingSession: null,
};
export const DEFAULT_SETTINGS: UserSettings = { dailyGoal: 30 };
