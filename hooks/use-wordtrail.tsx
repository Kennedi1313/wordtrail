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
import { supabase } from "@/lib/supabase/client";
import { loadCloudData, persistStateDiff } from "@/services/sync-service";
import {
  buildClubReadingProfile,
  syncClubReadingProfile,
} from "@/services/club-service";

type WordtrailContextValue = ReturnType<typeof createWordtrailState>;
const WordtrailContext = createContext<WordtrailContextValue | null>(null);

function syncFailureMessage(error: unknown) {
  if ((error as { code?: string })?.code === "40001")
    return "Seus dados mudaram em outra sessão. Recarregue a página antes de tentar de novo.";
  return error instanceof Error ? error.message : "Não foi possível salvar no servidor.";
}

function createWordtrailState() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState("Leitor");
  const [cloudReady, setCloudReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const syncedProfileRef = useRef("");
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const mutationQueueRef = useRef(Promise.resolve());
  const serverVersionRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
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
    if (!supabase) {
      setSyncError("O servidor não está configurado. Entre novamente quando ele estiver disponível.");
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    async function loadServerState() {
      const { data, error } = await supabase!.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      const id = user?.id || null;
      setUserId(id);
      setUserEmail(user?.email);
      setAuthReady(true);
      setDisplayName(
        String(
          user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split("@")[0] ||
            "Leitor",
        ),
      );
      if (!id) {
        const empty = structuredClone(DEFAULT_STATE);
        stateRef.current = empty;
        settingsRef.current = DEFAULT_SETTINGS;
        setState(empty);
        setSettings(DEFAULT_SETTINGS);
        setReady(false);
        setCloudReady(false);
        return;
      }
      const cloud = await loadCloudData(id);
      if (!cloud) throw new Error("O servidor não está disponível.");
      if (cancelled) return;
      const nextState = { ...cloud.state, books: cloud.state.books || [] };
      serverVersionRef.current = cloud.version;
      stateRef.current = nextState;
      settingsRef.current = cloud.settings;
      setState(nextState);
      setSettings(cloud.settings);
      setCloudReady(true);
      setReady(true);
      setSyncError(null);
    }
    void loadServerState().catch((error) => {
      if (!cancelled) {
        setAuthReady(true);
        setCloudReady(false);
        setReady(false);
        setSyncError(error instanceof Error ? error.message : "Não foi possível carregar seus dados do servidor.");
      }
    });
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserId(session?.user.id || null);
      setUserEmail(session?.user.email);
      setAuthReady(true);
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
        setReady(false);
        const empty = structuredClone(DEFAULT_STATE);
        stateRef.current = empty;
        settingsRef.current = DEFAULT_SETTINGS;
        setState(empty);
        setSettings(DEFAULT_SETTINGS);
        syncedProfileRef.current = "";
        return;
      }
      try {
        const cloud = await loadCloudData(session.user.id);
        if (!cloud || cancelled) return;
        const nextState = { ...cloud.state, books: cloud.state.books || [] };
        serverVersionRef.current = cloud.version;
        stateRef.current = nextState;
        settingsRef.current = cloud.settings;
        setState(nextState);
        setSettings(cloud.settings);
        setCloudReady(true);
        setReady(true);
        setSyncError(null);
      } catch (error) {
        setAuthReady(true);
        setCloudReady(false);
        setReady(false);
        setSyncError(error instanceof Error ? error.message : "Não foi possível carregar seus dados do servidor.");
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
      setSyncError("Não foi possível sincronizar seu perfil de leitura com os clubes.");
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
      if (!userId || !cloudReady || !ready) {
        const error = new Error("Aguarde a conexão com o servidor para continuar.");
        setSyncError(error.message);
        return Promise.reject(error);
      }
      const task = async () => {
        const current = stateRef.current;
        const next = typeof action === "function" ? action(current) : action;
        try {
        setSyncPending(true);
          serverVersionRef.current = await persistStateDiff(current, next, settingsRef.current, settingsRef.current, serverVersionRef.current);
          stateRef.current = next;
          setState(next);
          setSyncError(null);
        } catch (error) {
          setSyncError(syncFailureMessage(error));
          throw error;
        } finally {
          setSyncPending(false);
        }
      };
      const queued = mutationQueueRef.current.then(task, task);
      mutationQueueRef.current = queued.catch(() => undefined);
      return queued;
    },
    [cloudReady, ready, userId],
  );
  const updateSettings = useCallback(
    (action: SetStateAction<UserSettings>) => {
      if (!userId || !cloudReady || !ready) {
        const error = new Error("Aguarde a conexão com o servidor para continuar.");
        setSyncError(error.message);
        return Promise.reject(error);
      }
      const task = async () => {
        const current = settingsRef.current;
        const next = typeof action === "function" ? action(current) : action;
        try {
          setSyncPending(true);
          serverVersionRef.current = await persistStateDiff(stateRef.current, stateRef.current, current, next, serverVersionRef.current);
          settingsRef.current = next;
          setSettings(next);
          setSyncError(null);
        } catch (error) {
          setSyncError(syncFailureMessage(error));
          throw error;
        } finally {
          setSyncPending(false);
        }
      };
      const queued = mutationQueueRef.current.then(task, task);
      mutationQueueRef.current = queued.catch(() => undefined);
      return queued;
    },
    [cloudReady, state, userId],
  );

  const addWord = useCallback(
    (word: Word) => {
      return updateState((current) => {
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
      state.words.filter((word) =>
        Boolean(word.definition?.trim()) &&
        (!word.dueAt || new Date(word.dueAt).getTime() <= Date.now()),
      ),
    [state],
  );
  return {
    state,
    setState: updateState,
    settings,
    setSettings: updateSettings,
    ready,
    authReady,
    user: userId ? { id: userId, email: userEmail } : null,
    configured: Boolean(supabase),
    signIn: async () => {
      if (!supabase) return;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
    cloudReady,
    syncError,
    syncPending,
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
