import { ReadingSession, UserSettings } from "@/types/domain";

const TIME_ZONE = "America/Fortaleza";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function localReadingDate(value: string | Date | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function sessionDate(session: ReadingSession) {
  if (session.date && DATE_KEY.test(session.date)) {
    const startedUtcDate = session.startedAt.slice(0, 10);
    return session.date === startedUtcDate
      ? localReadingDate(session.startedAt)
      : session.date;
  }
  return localReadingDate(session.startedAt);
}

function sessionSeconds(session: ReadingSession, now: number) {
  const storedSeconds = Math.max(
    session.seconds || 0,
    session.durationSeconds || 0,
    (session.minutes || 0) * 60,
  );
  if (session.active === false || session.endedAt) return storedSeconds;
  return Math.max(
    storedSeconds,
    Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
  );
}

export function readingMinutesByDate(
  sessions: ReadingSession[],
  activeSession: ReadingSession | null,
  now = Date.now(),
) {
  const secondsByDate = new Map<string, number>();
  for (const session of [...sessions, ...(activeSession ? [activeSession] : [])]) {
    const date = sessionDate(session);
    secondsByDate.set(
      date,
      (secondsByDate.get(date) || 0) + sessionSeconds(session, now),
    );
  }
  return new Map(
    [...secondsByDate].map(([date, seconds]) => [date, Math.floor(seconds / 60)]),
  );
}

export function readingGoalStreak(
  sessions: ReadingSession[],
  activeSession: ReadingSession | null,
  dailyGoal: UserSettings["dailyGoal"],
  now = Date.now(),
) {
  const goal = Math.max(1, Math.floor(dailyGoal || 1));
  const minutesByDate = readingMinutesByDate(sessions, activeSession, now);
  const today = localReadingDate(now);
  let cursor = new Date(`${today}T00:00:00.000Z`);

  if ((minutesByDate.get(today) || 0) < goal) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while ((minutesByDate.get(cursor.toISOString().slice(0, 10)) || 0) >= goal) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
