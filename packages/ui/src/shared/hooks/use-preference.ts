import { useCallback, useState } from "react";

export function usePreference<T>(
  _key: string,
  defaultValue: T,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState(defaultValue);
  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue(next);
  }, []);
  return [value, update];
}
