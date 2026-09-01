import { internalTableMetadata } from "@dc-inventory/api-client-internal";
import {
  declaredFilterParams,
  parseBooleanFilterParam,
  type ListQueryParams,
  type TableMeta,
} from "@dc-inventory/ui-internal";
import { inventoryListTable } from "./inventory-list-table";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

const STAFF_TABLE_METAS: readonly TableMeta[] = [
  ...Object.values(internalTableMetadata),
  inventoryListTable,
];

/** Union of unprefixed list keys used on any staff dashboard table. */
export function allStaffTableUrlKeys(): string[] {
  const keys = new Set<string>();
  for (const meta of STAFF_TABLE_METAS) {
    for (const key of tableUrlKeys(meta)) {
      keys.add(key);
    }
  }
  return [...keys];
}

/** Unprefixed v1 keys: page, sort, search param, and declared `x-table` filters. */
export function tableUrlKeys(meta: TableMeta): string[] {
  const keys = meta.sort ? ["page", "sortBy", "sortOrder"] : ["page"];
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
  if (sortBy && meta.sort?.fields.includes(sortBy)) {
    params.sortBy = sortBy;
  }

  const sortOrder = firstValue(searchParams, "sortOrder");
  if (meta.sort && (sortOrder === "asc" || sortOrder === "desc")) {
    params.sortOrder = sortOrder;
  }

  if (meta.search) {
    const search = firstValue(searchParams, meta.search.param);
    if (search) {
      params[meta.search.param] = search;
    }
  }

  const allowed = declaredFilterParams(meta);
  for (const filter of meta.filters ?? []) {
    const apply = (key: string, control: (typeof filter)["control"]) => {
      if (!allowed.has(key)) {
        return;
      }
      const raw = firstValue(searchParams, key);
      if (raw === undefined || raw === "") {
        return;
      }
      if (control === "boolean") {
        const parsed = parseBooleanFilterParam(raw);
        if (parsed !== undefined) {
          params[key] = parsed;
        }
        return;
      }
      params[key] = raw;
    };
    apply(filter.param, filter.control);
    if (filter.control === "dateRange" && filter.rangePair) {
      apply(filter.rangePair, "date");
    }
  }

  return params;
}

export type TableUrlWriteOptions = {
  /** Boolean filters omitted from the URL when they match this default. */
  booleanFilterDefaults?: Record<string, boolean>;
};

/**
 * Drops table defaults so a clean address bar stays clean after reload.
 * API/query hooks may still apply their own defaults separately.
 */
export function tableParamsForUrl(
  meta: TableMeta,
  params: ListQueryParams,
  options?: TableUrlWriteOptions,
): ListQueryParams {
  const urlParams: ListQueryParams = { ...params };

  delete urlParams.pageSize;

  if (urlParams.page === 1) {
    delete urlParams.page;
  }

  if (meta.sort) {
    if (urlParams.sortBy === meta.sort.defaultBy) {
      delete urlParams.sortBy;
    }
    if (urlParams.sortOrder === meta.sort.defaultOrder) {
      delete urlParams.sortOrder;
    }
  }

  for (const [key, defaultValue] of Object.entries(
    options?.booleanFilterDefaults ?? {},
  )) {
    if (urlParams[key] === defaultValue) {
      delete urlParams[key];
    }
  }

  return urlParams;
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
  for (const key of allStaffTableUrlKeys()) {
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
 * Drops every staff list key from the current URL. Used on route changes so
 * catalog filters do not leak into inventory (and vice versa).
 */
export function stripStaffTableUrlParams(pathname?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const search = new URLSearchParams(window.location.search);
  let changed = false;
  for (const key of allStaffTableUrlKeys()) {
    if (search.has(key)) {
      search.delete(key);
      changed = true;
    }
  }
  if (!changed) {
    return;
  }
  const path = pathname ?? window.location.pathname;
  const query = search.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${path}${query === "" ? "" : `?${query}`}${window.location.hash}`,
  );
}

/**
 * Writes table keys with `history.replaceState` so the back button is not a
 * stack of every keystroke. Does not import Next navigation.
 */
export function replaceTableUrlParams(
  meta: TableMeta,
  params: ListQueryParams,
  options?: TableUrlWriteOptions,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = tableSearchFromParams(
    meta,
    tableParamsForUrl(meta, params, options),
    window.location.search,
  );
  const target = `${window.location.pathname}${next}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === current) {
    return;
  }
  window.history.replaceState(window.history.state, "", target);
}
