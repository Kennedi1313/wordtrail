"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReadingSession, Word } from "@/types/domain";
import { useWordtrail } from "@/hooks/use-wordtrail";

export function useReadingSession() {
  const { state, setState } = useWordtrail();
  const [now, setNow] = useState(Date.now());
  const active = state.activeReadingSession;
  useEffect(() => {
    if (!active || active.endedAt || active.active === false) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const elapsed = useMemo(
    () =>
      active
        ? active.active === false
          ? active.seconds || 0
          : Math.max(
              0,
              Math.floor((now - new Date(active.startedAt).getTime()) / 1000),
            )
        : 0,
    [active, now],
  );
  const start = useCallback((bookId?: string) => {
    if (state.activeReadingSession) return;
    const startedAt = new Date().toISOString();
    const session: ReadingSession = {
      id: crypto.randomUUID(),
      bookId,
      startedAt,
      date: startedAt.slice(0, 10),
      seconds: 0,
      durationSeconds: 0,
      pages: 0,
      lookups: [],
    };
    setState((current) => ({ ...current, activeReadingSession: session }));
  }, [setState, state.activeReadingSession]);
  const finish = useCallback(() => {
    if (!active) return;
    setState((current) => ({
      ...current,
      activeReadingSession: {
        ...active,
        endedAt: new Date().toISOString(),
        durationSeconds: elapsed,
        seconds: elapsed,
        minutes: Math.floor(elapsed / 60),
        createdAt: active.startedAt,
      },
    }));
  }, [active, elapsed, setState]);
  const pause = useCallback(() => {
    if (!active || active.endedAt || active.active === false) return;
    const pausedAt = Date.now();
    setNow(pausedAt);
    setState((current) => ({
      ...current,
      activeReadingSession: current.activeReadingSession
        ? {
            ...current.activeReadingSession,
            active: false,
            pausedAt: new Date(pausedAt).toISOString(),
            seconds: elapsed,
            durationSeconds: elapsed,
          }
        : null,
    }));
  }, [active, elapsed, setState]);
  const continueReading = useCallback(() => {
    if (!active || active.endedAt || active.active !== false) return;
    const seconds = active.seconds || 0;
    const resumedAt = Date.now();
    setNow(resumedAt);
    setState((current) => ({
      ...current,
      activeReadingSession: current.activeReadingSession
        ? {
            ...current.activeReadingSession,
            active: true,
            pausedAt: undefined,
            startedAt: new Date(resumedAt - seconds * 1000).toISOString(),
          }
        : null,
    }));
  }, [active, setState]);
  const save = useCallback(
    (pages: number, note: string) => {
      if (!active?.endedAt) return;
      const completed = { ...active, pages, note };
      setState((current) => ({
        ...current,
        activeReadingSession: null,
        readingSessions: [completed, ...current.readingSessions],
        books: completed.bookId
          ? current.books.map((book) =>
              book.id === completed.bookId
                ? {
                    ...book,
                    currentPage: Math.min(book.totalPages, book.currentPage + pages),
                    updatedAt: new Date().toISOString(),
                  }
                : book,
            )
          : current.books,
        words: Object.values(active.pendingWords || {}).reduce(
          (words, word) => {
            const existing = words.find(
              (item) => item.normalized === word.normalized,
            );
            return existing
              ? words.map((item) =>
                  item.normalized === word.normalized
                    ? { ...item, ...word }
                    : item,
                )
              : [word, ...words];
          },
          current.words,
        ),
      }));
    },
    [active, setState],
  );
  const resume = useCallback(
    () =>
      setState((current) => ({
        ...current,
        activeReadingSession: current.activeReadingSession
          ? { ...current.activeReadingSession, endedAt: undefined }
          : null,
      })),
    [setState],
  );
  const discard = useCallback(
    () =>
      setState((current) => {
        const snapshots = active?.wordSnapshots || {};
        const pending = active?.pendingWords || {};
        const pendingTerms = new Set(Object.keys(pending));
        const restoredWords = current.words
          .filter((word) => !pendingTerms.has(word.normalized))
          .concat(
            Object.values(snapshots).filter(
              (word): word is Word => word !== null,
            ),
          );
        const uniqueWords = restoredWords.filter(
          (word, index, words) =>
            words.findIndex((item) => item.normalized === word.normalized) ===
            index,
        );
        return {
          ...current,
          activeReadingSession: null,
          words: uniqueWords,
        };
      }),
    [active, setState],
  );
  const remove = useCallback(
    (id: string) =>
      setState((current) => ({
        ...current,
        readingSessions: current.readingSessions.filter(
          (session) => session.id !== id,
        ),
      })),
    [setState],
  );
  const trackLookup = useCallback(
    (word: Word) => {
      if (!active) return;
      const lookup = {
        at: new Date().toISOString(),
        term: word.term,
        normalized: word.normalized,
        translation: word.translation,
        wasKnown: state.words.some(
          (item) => item.normalized === word.normalized,
        ),
      };
      setState((current) => ({
        ...current,
        activeReadingSession: current.activeReadingSession
          ? {
              ...current.activeReadingSession,
              wordSnapshots: {
                ...(current.activeReadingSession.wordSnapshots || {}),
                [word.normalized]:
                  current.activeReadingSession.wordSnapshots?.[
                    word.normalized
                  ] ??
                  (current.words.find(
                    (item) => item.normalized === word.normalized,
                  ) ||
                    null),
              },
              pendingWords: {
                ...(current.activeReadingSession.pendingWords || {}),
                [word.normalized]: word,
              },
              lookups: [
                ...(current.activeReadingSession.lookups || []),
                lookup,
              ],
            }
          : null,
      }));
    },
    [active, setState, state.words],
  );
  const updateLookupTranslation = useCallback(
    (normalized: string, translation: string) =>
      setState((current) => ({
        ...current,
        activeReadingSession: current.activeReadingSession
          ? {
              ...current.activeReadingSession,
              lookups: (current.activeReadingSession.lookups || []).map(
                (lookup) =>
                  lookup.normalized === normalized
                    ? { ...lookup, translation }
                    : lookup,
              ),
              pendingWords: current.activeReadingSession.pendingWords
                ? {
                    ...current.activeReadingSession.pendingWords,
                    [normalized]: {
                      ...current.activeReadingSession.pendingWords[normalized],
                      translation,
                    },
                  }
                : current.activeReadingSession.pendingWords,
            }
          : null,
      })),
    [setState],
  );
  return {
    active,
    elapsed,
    start,
    finish,
    pause,
    continueReading,
    save,
    resume,
    discard,
    remove,
    trackLookup,
    updateLookupTranslation,
    history: state.readingSessions,
  };
}
