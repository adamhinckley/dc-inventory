export const PREFERENCE_KEY_PREFIX = "dc-inventory.pref.";

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readPreference<T>(key: string, fallback: T): T {
  const raw = storage()?.getItem(PREFERENCE_KEY_PREFIX + key);
  if (raw == null) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePreference<T>(key: string, value: T): void {
  try {
    storage()?.setItem(PREFERENCE_KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota, private mode, or missing Storage — keep in-memory state only.
  }
}
