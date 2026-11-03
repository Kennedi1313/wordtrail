"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  AppState,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  UserSettings,
  Word,
} from "@/types/domain";
import {
  loadSettings,
  loadState,
  saveSettings,
  saveState,
} from "@/lib/storage/local-storage";
import { supabase } from "@/lib/supabase/client";
import { loadCloudData, saveCloudData } from "@/services/sync-service";

type WordtrailContextValue = ReturnType<typeof createWordtrailState>;
const WordtrailContext = createContext<WordtrailContextValue | null>(null);

function createWordtrailState() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setState(loadState());
    setSettings(loadSettings());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveState(state);
  }, [state, ready]);
  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id || null;
      setUserId(id);
      if (!id) return;
      const cloud = await loadCloudData(id).catch(() => null);
      if (!cancelled && cloud) {
        setState(cloud.state);
        setSettings(cloud.settings);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUserId(session?.user.id || null),
    );
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (userId && ready) {
      const timeout = window.setTimeout(() => {
        void saveCloudData(userId, state, settings);
      }, 600);
      return () => window.clearTimeout(timeout);
    }
  }, [userId, state, settings, ready]);

  const addWord = useCallback((word: Word) => {
    setState((current) => {
      const existing = current.words.find(
        (item) => item.normalized === word.normalized,
      );
      if (existing)
        return {
          ...current,
          words: current.words.map((item) =>
            item.normalized === word.normalized ? { ...item, ...word } : item,
          ),
        };
      return { ...current, words: [word, ...current.words] };
    });
  }, []);
  const removeWord = useCallback(
    (normalized: string) =>
      setState((current) => ({
        ...current,
        words: current.words.filter((word) => word.normalized !== normalized),
      })),
    [],
  );
  const dueWords = useMemo(
    () =>
      state.words.filter(
        (word) => !word.dueAt || new Date(word.dueAt).getTime() <= Date.now(),
      ),
    [state],
  );
  return {
    state,
    setState,
    settings,
    setSettings,
    ready,
    addWord,
    removeWord,
    dueWords,
    userId,
  };
}

export function WordtrailProvider({ children }: { children: ReactNode }) {
  return (
    <WordtrailContext.Provider value={createWordtrailState()}>
      {children}
    </WordtrailContext.Provider>
  );
}
export function useWordtrail() {
  const context = useContext(WordtrailContext);
  if (!context)
    throw new Error("useWordtrail must be used inside WordtrailProvider");
  return context;
}
