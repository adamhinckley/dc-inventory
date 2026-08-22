import type { ListQueryParams, TableMeta } from "@dc-inventory/ui-internal";

export type SearchParamRecord = Record<string, string | string[] | undefined>;

function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value === "" ? undefined : value;
}

function declaredFilterParams(meta: TableMeta): string[] {
  const keys: string[] = [];
  for (const filter of meta.filters) {
    keys.push(filter.param);
    if (filter.control === "dateRange" && filter.rangePair) {
      keys.push(filter.rangePair);
    }
  }
  return keys;
}

/** Unprefixed share keys for one table per route. `pageSize` is not in the URL. */
export function tableUrlKeys(meta: TableMeta): string[] {
  const keys = ["page", "sortBy", "sortOrder"];
  if (meta.search) {
    keys.push(meta.search.param);
  }
  keys.push(...declaredFilterParams(meta));
  return keys;
}

/**
 * Maps App Router `searchParams` onto DataTable `initialParams`
 * (`page`, `sortBy`, `sortOrder`, `q`, and `meta.filters` only).
 */
export function tableParamsFromSearchParams(
  meta: TableMeta,
  searchParams: SearchParamRecord,
): ListQueryParams {
  const params: ListQueryParams = {};

  const pageRaw = firstSearchValue(searchParams.page);
  if (pageRaw !== undefined) {
    const page = Number.parseInt(pageRaw, 10);
    if (Number.isInteger(page) && page >= 1) {
      params.page = page;
    }
  }

  const sortBy = firstSearchValue(searchParams.sortBy);
  if (sortBy !== undefined && meta.sort.fields.includes(sortBy)) {
    params.sortBy = sortBy;
  }

  const sortOrder = firstSearchValue(searchParams.sortOrder);
  if (sortOrder === "asc" || sortOrder === "desc") {
    params.sortOrder = sortOrder;
  }

  if (meta.search) {
    const q = firstSearchValue(searchParams[meta.search.param]);
    if (q !== undefined) {
      params[meta.search.param] = q;
    }
  }

  for (const filter of meta.filters) {
    const keys =
      filter.control === "dateRange" && filter.rangePair
        ? [filter.param, filter.rangePair]
        : [filter.param];
    for (const key of keys) {
      const raw = firstSearchValue(searchParams[key]);
      if (raw === undefined) {
        continue;
      }
      if (filter.control === "boolean" && key === filter.param) {
        if (raw === "true") {
          params[key] = true;
        }
        continue;
      }
      params[key] = raw;
    }
  }

  return params;
}

/** Serializes current list params onto the same unprefixed URL keys. */
export function tableUrlSearchParams(
  meta: TableMeta,
  params: ListQueryParams,
): URLSearchParams {
  const search = new URLSearchParams();
  const defaults = {
    page: 1,
    sortBy: meta.sort.defaultBy,
    sortOrder: meta.sort.defaultOrder,
  };

  if (typeof params.page === "number" && params.page !== defaults.page) {
    search.set("page", String(params.page));
  }
  if (typeof params.sortBy === "string" && params.sortBy !== defaults.sortBy) {
    search.set("sortBy", params.sortBy);
  }
  if (
    (params.sortOrder === "asc" || params.sortOrder === "desc") &&
    params.sortOrder !== defaults.sortOrder
  ) {
    search.set("sortOrder", params.sortOrder);
  }

  if (meta.search) {
    const q = params[meta.search.param];
    if (typeof q === "string" && q !== "") {
      search.set(meta.search.param, q);
    }
  }

  for (const key of declaredFilterParams(meta)) {
    const value = params[key];
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }

  return search;
}

/**
 * Writes table params with `history.replaceState` so keystrokes do not stack
 * the back button. Does not `push`.
 */
export function replaceTableUrl(meta: TableMeta, params: ListQueryParams): void {
  const url = new URL(window.location.href);
  for (const key of tableUrlKeys(meta)) {
    url.searchParams.delete(key);
  }
  for (const [key, value] of tableUrlSearchParams(meta, params)) {
    url.searchParams.set(key, value);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}
