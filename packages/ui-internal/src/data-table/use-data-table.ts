"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  listParamsFromState,
  tableStateFromParams,
  type DataTableState,
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

export type FilterOption = {
  value: string;
  label: string;
};

export type DataTableRootProps<TParams = ListQueryParams, TRow = Record<string, unknown>> = {
  meta: TableMeta;
  queryHook: ListQueryHook<TParams, TRow>;
  /** Option lists for `select` filters that already exist on `meta.filters`. */
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>;
  /** First paint from the page (App Router `searchParams`). Omitting uses `x-table` defaults. */
  initialParams?: ListQueryParams;
  /** Page-owned write-back. Called after the first paint on every param change. */
  onParamsChange?: (params: ListQueryParams) => void;
  children?: ReactNode;
};

/**
 * Unwraps a bare `{ items, page, pageSize, total }` envelope or the Orval
 * `{ data, status, headers }` wrapper.
 *
 * Use when reading a list query result outside `DataTable` slots. Prefer the
 * slots when rendering a staff table. Do not treat TanStack Query as UI state.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```ts
 * import { unwrapListData } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * const query = useListInternalProducts({ page: 2, q: "bolt" });
 * const envelope = unwrapListData(query.data);
 * ```
 */
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

export type DataTableContextValue<TRow = Record<string, unknown>> = {
  meta: TableMeta;
  state: DataTableState;
  setState: Dispatch<SetStateAction<DataTableState>>;
  params: ListQueryParams;
  query: ListQueryResult<TRow>;
  envelope: ListEnvelope<TRow> | undefined;
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>;
};

export const DataTableContext = createContext<DataTableContextValue | null>(null);

/**
 * Per-`DataTable.Root` table state, list params, and unwrapped query result.
 *
 * Use from a child of `DataTable.Root` when composing the v1 slots or a thin
 * custom chrome around the same instance. Do not call it outside a Root — each
 * Root is its own React context, and two Roots must not share state.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { DataTable, useDataTable } from "@dc-inventory/ui-internal";
 *
 * function CatalogStatus() {
 *   const { params } = useDataTable();
 *   return <p>Page {params.page}</p>;
 * }
 *
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <CatalogStatus />
 *   <DataTable.Table />
 * </DataTable.Root>
 * ```
 */
export function useDataTable<TRow = Record<string, unknown>>(): DataTableContextValue<TRow> {
  const value = useContext(DataTableContext);
  if (!value) {
    throw new Error("useDataTable must be used within DataTable.Root");
  }
  return value as DataTableContextValue<TRow>;
}

export function useDataTableRootModel<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
>(props: DataTableRootProps<TParams, TRow>): DataTableContextValue<TRow> {
  const { meta, queryHook, filterOptions, initialParams, onParamsChange } = props;
  const [state, setState] = useState<DataTableState>(() =>
    tableStateFromParams(meta, initialParams),
  );
  const params = useMemo(
    () => listParamsFromState(meta, state),
    [meta, state],
  );
  const query = queryHook(params as TParams);
  const envelope = unwrapListData(query.data);

  const onParamsChangeRef = useRef(onParamsChange);
  onParamsChangeRef.current = onParamsChange;
  const isFirstPaint = useRef(true);

  useEffect(() => {
    if (isFirstPaint.current) {
      isFirstPaint.current = false;
      return;
    }
    onParamsChangeRef.current?.(params);
  }, [params]);

  return {
    meta,
    state,
    setState,
    params,
    query,
    envelope,
    filterOptions,
  };
}
