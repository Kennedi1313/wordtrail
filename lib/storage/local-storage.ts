import {
  AppState,
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  UserSettings,
} from "@/types/domain";

export const STORAGE_KEY = "wordtrail-data-v1";
export const SETTINGS_KEY = "wordtrail-settings-v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadState(key = STORAGE_KEY): AppState {
  const value = readJson<Partial<AppState>>(key, {});
  if (
    !Array.isArray(value.words) ||
    !Array.isArray(value.readingSessions) ||
    !Array.isArray(value.reviews)
  )
    return structuredClone(DEFAULT_STATE);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...value,
    books: Array.isArray(value.books) ? value.books : [],
  };
}

export function loadSettings(key = SETTINGS_KEY): UserSettings {
  const value = readJson<Partial<UserSettings>>(key, {});
  return { ...DEFAULT_SETTINGS, ...value };
}

export function saveState(state: AppState, key = STORAGE_KEY) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(key, JSON.stringify(state));
}

export function saveSettings(settings: UserSettings, key = SETTINGS_KEY) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(key, JSON.stringify(settings));
}
