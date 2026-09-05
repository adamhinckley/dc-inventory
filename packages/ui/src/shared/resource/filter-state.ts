import type { FilterValue } from "./types";

export type ActiveFilter = {
  field: string;
  value: FilterValue;
};

export type FilterState = {
  active: ActiveFilter[];
  search: string;
  setSearch: (search: string) => void;
  onAdd: (field: string) => void;
  onRemove: (field: string) => void;
  onUpdate: (field: string, value: FilterValue) => void;
  onClear: () => void;
};
