"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  SetStateAction,
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
import { loadCloudData, persistStateDiff } from "@/services/sync-service";
import {
  buildClubReadingProfile,
  syncClubReadingProfile,
} from "@/services/club-service";

type WordtrailContextValue = ReturnType<typeof createWordtrailState>;
const WordtrailContext = createContext<WordtrailContextValue | null>(null);

function createWordtrailState() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Leitor");
  const [cloudReady, setCloudReady] = useState(false);
  const syncedProfileRef = useRef("");

  useEffect(() => {
    setState(loadState());
    setSettings(loadSettings());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const applyTheme = () => {
      const isDark =
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = isDark ? "dark" : "light";
    };
    applyTheme();
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.theme, ready]);
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
      const user = data.session?.user;
      const id = user?.id || null;
      setUserId(id);
      setDisplayName(
        String(
          user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split("@")[0] ||
            "Leitor",
        ),
      );
      if (!id) return;
      const cloud = await loadCloudData(id).catch(() => null);
      if (!cancelled && cloud) {
        setState({ ...cloud.state, books: cloud.state.books || [] });
        setSettings(cloud.settings);
        setCloudReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setDisplayName(
        String(
          session?.user.user_metadata?.full_name ||
            session?.user.user_metadata?.name ||
            session?.user.email?.split("@")[0] ||
            "Leitor",
        ),
      );
      if (!session) {
        setCloudReady(false);
        syncedProfileRef.current = "";
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!userId || !cloudReady) return;
    const profile = buildClubReadingProfile(state, settings, displayName);
    const syncKey = `${userId}:${JSON.stringify(profile)}`;
    if (syncedProfileRef.current === syncKey) return;
    syncedProfileRef.current = syncKey;
    void syncClubReadingProfile(userId, profile).catch(() => {
      if (syncedProfileRef.current === syncKey) syncedProfileRef.current = "";
    });
  }, [
    cloudReady,
    displayName,
    settings.dailyGoal,
    state.books,
    state.readingSessions,
    userId,
  ]);
  const updateState = useCallback(
    (action: SetStateAction<AppState>) => {
      setState((current) => {
        const next = typeof action === "function" ? action(current) : action;
        if (userId && cloudReady) {
          void persistStateDiff(
            userId,
            current,
            next,
            settings,
            settings,
          ).catch((error) => console.error("Wordtrail sync failed", error));
        }
        return next;
      });
    },
    [cloudReady, settings, userId],
  );
  const updateSettings = useCallback(
    (action: SetStateAction<UserSettings>) => {
      setSettings((current) => {
        const next = typeof action === "function" ? action(current) : action;
        if (userId && cloudReady) {
          void persistStateDiff(userId, state, state, current, next).catch(
            (error) => console.error("Wordtrail settings sync failed", error),
          );
        }
        return next;
      });
    },
    [cloudReady, state, userId],
  );

  const addWord = useCallback(
    (word: Word) => {
      updateState((current) => {
        const normalized = word.normalized.trim().toLowerCase();
        const term = word.term.trim().toLowerCase();
        let updated = false;
        const words = current.words.reduce<Word[]>((result, item) => {
          const sameWord =
            item.normalized.trim().toLowerCase() === normalized ||
            item.term.trim().toLowerCase() === term;
          if (!sameWord) {
            result.push(item);
            return result;
          }
          if (!updated) {
            result.push({ ...item, ...word, normalized });
            updated = true;
          }
          return result;
        }, []);
        return updated
          ? { ...current, words }
          : { ...current, words: [{ ...word, normalized }, ...words] };
      });
    },
    [updateState],
  );
  const removeWord = useCallback(
    (normalized: string) =>
      updateState((current) => ({
        ...current,
        words: current.words.filter((word) => word.normalized !== normalized),
      })),
    [updateState],
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
    setState: updateState,
    settings,
    setSettings: updateSettings,
    ready,
    cloudReady,
    addWord,
    removeWord,
    dueWords,
    userId,
    displayName,
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
