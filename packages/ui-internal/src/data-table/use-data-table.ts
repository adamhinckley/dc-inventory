"use client";

import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  listParamsFromState,
  tableStateFromInitial,
  type ListQueryParams,
} from "./list-params";
import type { TableMeta } from "./table-meta";

export type ListEnvelope<TRow> = {
  items: TRow[];
  page: number;
  pageSize: number;
  total: number;
};

/** Orval `customFetch` wraps the list envelope in `{ data, status, headers }`. */
export type OrvalListResponse<TRow> = {
  data: ListEnvelope<TRow>;
  status: number;
  headers?: Headers;
};

export type ListQueryResult<TRow = Record<string, unknown>> = {
  data?: ListEnvelope<TRow> | OrvalListResponse<TRow>;
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
};

export type ListQueryHook<TParams = ListQueryParams, TRow = Record<string, unknown>> = (
  params?: TParams,
) => ListQueryResult<TRow>;

export function unwrapListData<TRow>(
  data: ListQueryResult<TRow>["data"],
): ListEnvelope<TRow> | undefined {
  if (!data) {
    return undefined;
  }
  if ("items" in data && Array.isArray(data.items)) {
    return data;
  }
  if ("data" in data && data.data && Array.isArray(data.data.items)) {
    return data.data;
  }
  return undefined;
}

const subscribeHydration = () => () => {};

/** `false` on the server and during hydration so list chrome matches SSR HTML. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => true, () => false);
}

/**
 * Full-table loading chrome. Ignore React Query `isLoading` here: on the server
 * `fetchStatus` is idle, so `isLoading` is false while the client first paint
 * is fetching — that mismatch disabled the Next button (`true` vs `null`).
 */
export function isListQueryFailed(
  hydrated: boolean,
  data: ListQueryResult<unknown>["data"],
): boolean {
  return hydrated && data !== undefined && !isSuccessfulOrvalResponse(data);
}

export function isListTableBusy(
  hydrated: boolean,
  envelope: ListEnvelope<unknown> | undefined,
  isError: boolean | undefined,
): boolean {
  if (!hydrated) {
    return true;
  }
  return envelope === undefined && isError !== true;
}

export type UseDataTableOptions<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
> = {
  meta: TableMeta;
  queryHook: ListQueryHook<TParams, TRow>;
  /** First-paint list params from the page (e.g. parsed `searchParams`). */
  initialParams?: ListQueryParams;
  /** Page-owned write-back. Called after the first paint when chrome params change. */
  onParamsChange?: (params: ListQueryParams) => void;
};

/**
 * Per-mount DataTable list state: chrome → Orval params → injected `queryHook`.
 *
 * When to use: inside `DataTable.Root`, or on a staff page that needs the same
 * state machine without composing slots.
 *
 * When not to use: wholesale browse, or as a place to import Next
 * `useSearchParams` / Orval clients — pass `initialParams` and `onParamsChange`
 * from the page instead.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { useDataTable } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * const table = useDataTable({
 *   meta: productsListTable,
 *   queryHook: useListInternalProducts,
 *   initialParams,
 *   onParamsChange,
 * });
 * ```
 */
export function useDataTable<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
>({
  meta,
  queryHook,
  initialParams,
  onParamsChange,
}: UseDataTableOptions<TParams, TRow>) {
  const [state, setState] = useState(() => tableStateFromInitial(meta, initialParams));
  const params = useMemo(
    () => listParamsFromState(meta, state),
    [meta, state],
  );
  const onParamsChangeRef = useRef(onParamsChange);
  onParamsChangeRef.current = onParamsChange;
  const skipFirstWrite = useRef(true);

  useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    onParamsChangeRef.current?.(params);
  }, [params]);

  const hydrated = useHydrated();
  const query = queryHook(params as TParams);
  const listFailed = isListQueryFailed(hydrated, query.data);
  const envelope =
    hydrated && !listFailed ? unwrapListData(query.data) : undefined;
  const items = envelope?.items ?? [];
  const total = envelope?.total ?? 0;
  const page = envelope?.page ?? state.page;
  const pageSize = envelope?.pageSize ?? state.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const busy = isListTableBusy(hydrated, envelope, query.isError || listFailed);

  return {
    meta,
    state,
    setState,
    params,
    query,
    listFailed,
    envelope,
    items,
    total,
    page,
    pageSize,
    pageCount,
    busy,
  };
}

export type DataTableModel<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
> = ReturnType<typeof useDataTable<TParams, TRow>>;
