"use client";

import { Button, Input, Label } from "@dc-inventory/ui";
import {
  createContext,
  useContext,
  useId,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { DataTableState, ListQueryParams } from "./list-params";
import type { TableFilterMeta, TableMeta } from "./table-meta";
import {
  useDataTable,
  type ListQueryHook,
} from "./use-data-table";

export type FilterOption = {
  value: string;
  label: string;
};

export type DataTableRootProps<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
> = {
  meta: TableMeta;
  queryHook: ListQueryHook<TParams, TRow>;
  /** Option lists for `select` filters that already exist on `meta.filters`. */
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>;
  /** Parsed App Router `searchParams` (or Storybook in-memory seed). */
  initialParams?: ListQueryParams;
  /** Page-owned URL adapter. Omit in Storybook. */
  onParamsChange?: (params: ListQueryParams) => void;
  children: ReactNode;
};

type DataTableContextValue = ReturnType<typeof useDataTable> & {
  filterOptions?: DataTableRootProps["filterOptions"];
  /** Per-Root prefix so two tables do not share form-control IDs. */
  idBase: string;
};

const DataTableContext = createContext<DataTableContextValue | null>(null);

function useDataTableContext(): DataTableContextValue {
  const value = useContext(DataTableContext);
  if (!value) {
    throw new Error("DataTable slots must render inside DataTable.Root");
  }
  return value;
}

function cellValue(row: Record<string, unknown>, field: string): ReactNode {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{value}</span>;
  }
  return String(value);
}

function FilterControl({
  filter,
  state,
  setState,
  options,
  idBase,
}: {
  filter: TableFilterMeta;
  state: DataTableState;
  setState: Dispatch<SetStateAction<DataTableState>>;
  options: readonly FilterOption[] | undefined;
  idBase: string;
}) {
  const setFilter = (param: string, value: string | boolean | undefined) => {
    setState((current) => ({
      ...current,
      page: 1,
      filters: { ...current.filters, [param]: value },
    }));
  };
  const filterId = `${idBase}-filter-${filter.param}`;

  if (filter.control === "select") {
    return (
      <div className="flex min-w-40 flex-col gap-2">
        <Label htmlFor={filterId}>{filter.param}</Label>
        <select
          id={filterId}
          className="flex h-10 w-full rounded-sm border border-border-strong bg-field-01 px-3 py-2 text-sm text-primary"
          value={String(state.filters[filter.param] ?? "")}
          onChange={(event) =>
            setFilter(filter.param, event.target.value || undefined)
          }
        >
          <option value="">All</option>
          {(options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (filter.control === "boolean") {
    return (
      <div className="flex items-end gap-2 pb-2">
        <input
          id={filterId}
          type="checkbox"
          checked={state.filters[filter.param] === true}
          onChange={(event) =>
            setFilter(filter.param, event.target.checked ? true : undefined)
          }
        />
        <Label htmlFor={filterId}>{filter.param}</Label>
      </div>
    );
  }

  if (filter.control === "dateRange") {
    const toParam = filter.rangePair;
    return (
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-40 flex-col gap-2">
          <Label htmlFor={filterId}>{filter.param}</Label>
          <Input
            id={filterId}
            type="date"
            value={String(state.filters[filter.param] ?? "")}
            onChange={(event) =>
              setFilter(filter.param, event.target.value || undefined)
            }
          />
        </div>
        {toParam ? (
          <div className="flex min-w-40 flex-col gap-2">
            <Label htmlFor={`${idBase}-filter-${toParam}`}>{toParam}</Label>
            <Input
              id={`${idBase}-filter-${toParam}`}
              type="date"
              value={String(state.filters[toParam] ?? "")}
              onChange={(event) =>
                setFilter(toParam, event.target.value || undefined)
              }
            />
          </div>
        ) : null}
      </div>
    );
  }

  const inputType = filter.control === "date" ? "date" : "text";
  return (
    <div className="flex min-w-40 flex-col gap-2">
      <Label htmlFor={filterId}>{filter.param}</Label>
      <Input
        id={filterId}
        type={inputType}
        value={String(state.filters[filter.param] ?? "")}
        onChange={(event) =>
          setFilter(filter.param, event.target.value || undefined)
        }
      />
    </div>
  );
}

/**
 * Per-instance DataTable context: chrome state, injected Orval hook, and slots.
 *
 * When to use: staff list pages. Compose `Search`, `Filters`, `Table`, and
 * `Pagination` as children. Two Roots never share state.
 *
 * When not to use: wholesale catalog, multiple tables on one route (v1 keys
 * are unprefixed), or inside `packages/ui-internal` with Next navigation.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { DataTable } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   filterOptions={{ status: productStatusFilterOptions }}
 *   initialParams={initialParams}
 *   onParamsChange={onParamsChange}
 * >
 *   <DataTable.Search />
 *   <DataTable.Filters />
 *   <DataTable.Table />
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export function DataTableRoot<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
>({
  meta,
  queryHook,
  filterOptions,
  initialParams,
  onParamsChange,
  children,
}: DataTableRootProps<TParams, TRow>) {
  const idBase = useId();
  const table = useDataTable({
    meta,
    queryHook,
    initialParams,
    onParamsChange,
  });

  return (
    <DataTableContext.Provider value={{ ...table, filterOptions, idBase }}>
      <div className="flex flex-col gap-4">{children}</div>
    </DataTableContext.Provider>
  );
}

/**
 * Search field from `meta.search`.
 *
 * When to use: list pages that declare `x-table.search`.
 * When not to use: outside `DataTable.Root`, or when the operation has no search.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Search />
 * </DataTable.Root>
 * ```
 */
export function DataTableSearch() {
  const { meta, state, setState, idBase } = useDataTableContext();
  if (!meta.search) {
    return null;
  }
  const searchId = `${idBase}-search`;

  return (
    <div className="flex min-w-56 flex-1 flex-col gap-2">
      <Label htmlFor={searchId}>{meta.search.placeholder}</Label>
      <Input
        id={searchId}
        value={state.search}
        placeholder={meta.search.placeholder}
        onChange={(event) =>
          setState((current) => ({
            ...current,
            page: 1,
            search: event.target.value,
          }))
        }
      />
    </div>
  );
}

/**
 * Declared `x-table` filters plus sort/order chrome.
 *
 * When to use: catalog-style lists that need status (or other declared) filters.
 * When not to use: inventing filters that are not on `meta.filters`.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   filterOptions={{ status: productStatusFilterOptions }}
 * >
 *   <DataTable.Filters />
 * </DataTable.Root>
 * ```
 */
export function DataTableFilters() {
  const { meta, state, setState, filterOptions, idBase } = useDataTableContext();
  const sortId = `${idBase}-sort`;
  const sortOrderId = `${idBase}-sort-order`;

  return (
    <div className="flex flex-wrap items-end gap-4">
      {meta.filters.map((filter) => (
        <FilterControl
          key={filter.param}
          filter={filter}
          state={state}
          setState={setState}
          options={filterOptions?.[filter.param]}
          idBase={idBase}
        />
      ))}
      <div className="flex min-w-40 flex-col gap-2">
        <Label htmlFor={sortId}>Sort</Label>
        <select
          id={sortId}
          className="flex h-10 w-full rounded-sm border border-border-strong bg-field-01 px-3 py-2 text-sm text-primary"
          value={state.sortBy}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              page: 1,
              sortBy: event.target.value,
            }))
          }
        >
          {meta.sort.fields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-28 flex-col gap-2">
        <Label htmlFor={sortOrderId}>Order</Label>
        <select
          id={sortOrderId}
          className="flex h-10 w-full rounded-sm border border-border-strong bg-field-01 px-3 py-2 text-sm text-primary"
          value={state.sortOrder}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              page: 1,
              sortOrder: event.target.value === "desc" ? "desc" : "asc",
            }))
          }
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Row grid for the current `queryHook` page.
 *
 * When to use: as the body slot under `DataTable.Root`.
 * When not to use: wholesale product cards, or as a standalone HTML table.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Table />
 * </DataTable.Root>
 * ```
 */
export function DataTableTable() {
  const { meta, items, query, busy } = useDataTableContext();

  return (
    <div className="overflow-x-auto rounded-sm border border-border-subtle">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-layer-01 text-secondary">
          <tr>
            {meta.columns.map((column) => (
              <th
                key={column.field}
                scope="col"
                className="border-b border-border-subtle px-4 py-3 font-medium"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {busy ? (
            <tr>
              <td
                className="px-4 py-6 text-helper"
                colSpan={meta.columns.length}
              >
                Loading…
              </td>
            </tr>
          ) : query.isError ? (
            <tr>
              <td
                className="px-4 py-6 text-error"
                colSpan={meta.columns.length}
              >
                {query.error instanceof Error
                  ? query.error.message
                  : "Unable to load rows"}
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td
                className="px-4 py-6 text-helper"
                colSpan={meta.columns.length}
              >
                No rows
              </td>
            </tr>
          ) : (
            items.map((item, index) => {
              const row = item as Record<string, unknown>;
              const rowKey = String(row[meta.rowId] ?? index);
              return (
                <tr
                  key={rowKey}
                  className={
                    index % 2 === 1 ? "bg-layer-accent-01" : "bg-background"
                  }
                >
                  {meta.columns.map((column) => (
                    <td
                      key={column.field}
                      className={
                        column.field === "sku"
                          ? "border-b border-border-subtle px-4 py-3 font-mono"
                          : "border-b border-border-subtle px-4 py-3"
                      }
                    >
                      {cellValue(row, column.field)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Previous/next pager bound to Root list state.
 *
 * When to use: under `DataTable.Table` on staff lists.
 * When not to use: as a generic pager outside Root (it reads table context).
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export function DataTablePagination() {
  const { page, pageCount, total, busy, setState } = useDataTableContext();

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-secondary">
      <p className="tabular-nums">
        Page {page} of {pageCount} · {total} rows
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page <= 1}
          onClick={() =>
            setState((current) => ({
              ...current,
              page: Math.max(1, current.page - 1),
            }))
          }
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page >= pageCount}
          onClick={() =>
            setState((current) => ({
              ...current,
              page: current.page + 1,
            }))
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Compound staff DataTable. `Root` is the per-instance context; compose slots.
 *
 * When to use: internal dashboard list pages with `x-table` + an Orval hook.
 * When not to use: wholesale shop, ops, or a second table on the same route.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { DataTable } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   initialParams={initialParams}
 *   onParamsChange={onParamsChange}
 * >
 *   <DataTable.Search />
 *   <DataTable.Filters />
 *   <DataTable.Table />
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export const DataTable = {
  Root: DataTableRoot,
  Search: DataTableSearch,
  Filters: DataTableFilters,
  Table: DataTableTable,
  Pagination: DataTablePagination,
};
