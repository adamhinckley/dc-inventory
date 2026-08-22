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

/** Accept only explicit boolean tokens. Invalid strings are ignored. */
export function parseBooleanFilterParam(
  value: string | number | boolean | undefined,
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

export function declaredFilterParams(meta: TableMeta): Set<string> {
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
 * Seeds chrome state from page-owned `initialParams` (usually App Router
 * `searchParams`). Missing keys fall back to `x-table` defaults so a deep
 * link like `?page=2&q=bolt` does not flash page 1.
 */
export function tableStateFromInitial(
  meta: TableMeta,
  initial?: ListQueryParams,
): DataTableState {
  const defaults = defaultTableState(meta);
  if (!initial) {
    return defaults;
  }

  const searchKey = meta.search?.param;
  const searchRaw = searchKey === undefined ? undefined : initial[searchKey];
  const allowed = declaredFilterParams(meta);
  const filters: DataTableState["filters"] = {};

  for (const [key, value] of Object.entries(initial)) {
    if (!allowed.has(key) || value === undefined || value === "") {
      continue;
    }
    if (typeof value === "boolean") {
      filters[key] = value;
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      const control = meta.filters.find(
        (filter) => filter.param === key || filter.rangePair === key,
      )?.control;
      if (control === "boolean") {
        const parsed = parseBooleanFilterParam(value);
        if (parsed !== undefined) {
          filters[key] = parsed;
        }
        continue;
      }
      filters[key] = String(value);
    }
  }

  const page =
    typeof initial.page === "number" && Number.isInteger(initial.page) && initial.page >= 1
      ? initial.page
      : defaults.page;
  const pageSize =
    typeof initial.pageSize === "number" &&
    Number.isInteger(initial.pageSize) &&
    initial.pageSize >= 1
      ? initial.pageSize
      : defaults.pageSize;
  const sortBy =
    typeof initial.sortBy === "string" && meta.sort.fields.includes(initial.sortBy)
      ? initial.sortBy
      : defaults.sortBy;
  const sortOrder =
    initial.sortOrder === "asc" || initial.sortOrder === "desc"
      ? initial.sortOrder
      : defaults.sortOrder;

  return {
    search: typeof searchRaw === "string" ? searchRaw : defaults.search,
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters,
  };
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
