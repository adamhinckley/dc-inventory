import type { Option } from "./types";

export function useFilterOptions(
  options?: Option[] | (() => Promise<Option[]>) | unknown,
  _source?: unknown,
): { options: Option[]; loading: boolean } {
  if (Array.isArray(options)) {
    return { options, loading: false };
  }
  return { options: [], loading: false };
}
