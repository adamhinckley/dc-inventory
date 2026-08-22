import { useCallback, useEffect, useState } from "react";
import { readPreference, writePreference } from "./preference-storage";

/**
 * Hydration-safe preference: first paint uses `defaultValue` (SSR-safe),
 * then `localStorage` is read in an effect. Writes persist under
 * `dc-inventory.pref.{key}`.
 */
export function usePreference<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(readPreference(key, defaultValue));
    // Hydrate once per key; callers pass stable literals as defaultValue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (current: T) => T)(current)
            : next;
        writePreference(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
