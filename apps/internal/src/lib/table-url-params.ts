import {
  declaredFilterParams,
  type ListQueryParams,
  type TableMeta,
} from "@dc-inventory/ui-internal";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Unprefixed v1 keys: page, sort, search param, and declared `x-table` filters. */
export function tableUrlKeys(meta: TableMeta): string[] {
  const keys = ["page", "sortBy", "sortOrder"];
  if (meta.search) {
    keys.push(meta.search.param);
  }
  for (const key of declaredFilterParams(meta)) {
    keys.push(key);
  }
  return keys;
}

function firstValue(
  searchParams: SearchParamsRecord,
  key: string,
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Maps App Router `searchParams` onto DataTable `initialParams`.
 * Ignores invented keys and `pageSize` (not a shareable v1 URL key).
 */
export function listParamsFromSearchParams(
  meta: TableMeta,
  searchParams: SearchParamsRecord,
): ListQueryParams {
  const params: ListQueryParams = {};
  const pageRaw = firstValue(searchParams, "page");
  const page = pageRaw === undefined ? Number.NaN : Number(pageRaw);
  if (Number.isInteger(page) && page >= 1) {
    params.page = page;
  }

  const sortBy = firstValue(searchParams, "sortBy");
  if (sortBy && meta.sort.fields.includes(sortBy)) {
    params.sortBy = sortBy;
  }

  const sortOrder = firstValue(searchParams, "sortOrder");
  if (sortOrder === "asc" || sortOrder === "desc") {
    params.sortOrder = sortOrder;
  }

  if (meta.search) {
    const search = firstValue(searchParams, meta.search.param);
    if (search) {
      params[meta.search.param] = search;
    }
  }

  const allowed = declaredFilterParams(meta);
  for (const filter of meta.filters) {
    const apply = (key: string, control: (typeof filter)["control"]) => {
      if (!allowed.has(key)) {
        return;
      }
      const raw = firstValue(searchParams, key);
      if (raw === undefined || raw === "") {
        return;
      }
      params[key] = control === "boolean" ? raw === "true" : raw;
    };
    apply(filter.param, filter.control);
    if (filter.control === "dateRange" && filter.rangePair) {
      apply(filter.rangePair, "date");
    }
  }

  return params;
}

/** Builds the next `?query` string for `replaceState` (never a new history entry). */
export function tableSearchFromParams(
  meta: TableMeta,
  params: ListQueryParams,
  currentSearch = "",
): string {
  const search = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  for (const key of tableUrlKeys(meta)) {
    search.delete(key);
  }
  for (const key of tableUrlKeys(meta)) {
    const value = params[key];
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * Writes table keys with `history.replaceState` so the back button is not a
 * stack of every keystroke. Does not import Next navigation.
 */
export function replaceTableUrlParams(
  meta: TableMeta,
  params: ListQueryParams,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = tableSearchFromParams(meta, params, window.location.search);
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${next}${window.location.hash}`,
  );
}
