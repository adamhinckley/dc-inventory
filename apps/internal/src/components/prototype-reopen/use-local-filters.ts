"use client";

import { useState } from "react";

export type FilterValue =
  | string
  | boolean
  | number
  | string[]
  | { from?: string; to?: string }
  | { min?: number; max?: number }
  | null;

export type ActiveFilter = { field: string; value: FilterValue };

export type FilterState = {
  active: ActiveFilter[];
  search: string;
  setSearch: (value: string) => void;
  onAdd: (field: string) => void;
  onRemove: (field: string) => void;
  onUpdate: (field: string, value: FilterValue) => void;
  onClear: () => void;
};

export function useLocalFilters(initial: ActiveFilter[] = []): FilterState {
  const [active, setActive] = useState<ActiveFilter[]>(initial);
  const [search, setSearch] = useState("");

  return {
    active,
    search,
    setSearch,
    onAdd: (field) => {
      setActive((prev) =>
        prev.some((row) => row.field === field) ? prev : [...prev, { field, value: null }],
      );
    },
    onRemove: (field) => setActive((prev) => prev.filter((row) => row.field !== field)),
    onUpdate: (field, value) =>
      setActive((prev) => prev.map((row) => (row.field === field ? { ...row, value } : row))),
    onClear: () => setActive([]),
  };
}

export function filterValue(active: ActiveFilter[], field: string): FilterValue {
  return active.find((row) => row.field === field)?.value ?? null;
}
