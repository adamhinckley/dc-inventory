import type { TableMeta } from "./table-meta";

/** Shared list query params from api-contract.md plus declared filter keys. */
export type ListQueryParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [filterParam: string]: string | number | boolean | undefined;
};

export type DataTableState = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  /** Values keyed by `x-table` filter params (and `rangePair` for date ranges). */
  filters: Record<string, string | boolean | undefined>;
};

export function defaultTableState(meta: TableMeta): DataTableState {
  return {
    search: "",
    page: 1,
    pageSize: 25,
    sortBy: meta.sort.defaultBy,
    sortOrder: meta.sort.defaultOrder,
    filters: {},
  };
}

function declaredFilterParams(meta: TableMeta): Set<string> {
  const allowed = new Set<string>();
  for (const filter of meta.filters) {
    allowed.add(filter.param);
    if (filter.control === "dateRange" && filter.rangePair) {
      allowed.add(filter.rangePair);
    }
  }
  return allowed;
}

/**
 * Builds Orval list params from chrome state.
 * Drops filter keys that are not in `meta.filters` (do not invent filters).
 */
export function listParamsFromState(
  meta: TableMeta,
  state: DataTableState,
): ListQueryParams {
  const params: ListQueryParams = {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  };

  if (meta.search) {
    const value = state.search.trim();
    if (value !== "") {
      params[meta.search.param] = value;
    }
  }

  const allowed = declaredFilterParams(meta);
  for (const [key, value] of Object.entries(state.filters)) {
    if (!allowed.has(key)) {
      continue;
    }
    if (value === undefined || value === "") {
      continue;
    }
    params[key] = value;
  }

  return params;
}
