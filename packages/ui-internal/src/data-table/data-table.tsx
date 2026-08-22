"use client";

import { Button, Input, Label } from "@dc-inventory/ui";
import { type ReactNode } from "react";
import type { TableFilterMeta } from "./table-meta";
import type { DataTableState, ListQueryParams } from "./list-params";
import {
  DataTableContext,
  useDataTable,
  useDataTableRootModel,
  type DataTableContextValue,
  type DataTableRootProps,
  type FilterOption,
} from "./use-data-table";

export type { DataTableRootProps, FilterOption, ListQueryHook } from "./use-data-table";

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
  setFilter,
  options,
}: {
  filter: TableFilterMeta;
  state: DataTableState;
  setFilter: (param: string, value: string | boolean | undefined) => void;
  options: readonly FilterOption[] | undefined;
}) {
  if (filter.control === "select") {
    return (
      <div className="flex min-w-40 flex-col gap-2">
        <Label htmlFor={`filter-${filter.param}`}>{filter.param}</Label>
        <select
          id={`filter-${filter.param}`}
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
          id={`filter-${filter.param}`}
          type="checkbox"
          checked={state.filters[filter.param] === true}
          onChange={(event) =>
            setFilter(filter.param, event.target.checked ? true : undefined)
          }
        />
        <Label htmlFor={`filter-${filter.param}`}>{filter.param}</Label>
      </div>
    );
  }

  if (filter.control === "dateRange") {
    const toParam = filter.rangePair;
    return (
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-40 flex-col gap-2">
          <Label htmlFor={`filter-${filter.param}`}>{filter.param}</Label>
          <Input
            id={`filter-${filter.param}`}
            type="date"
            value={String(state.filters[filter.param] ?? "")}
            onChange={(event) =>
              setFilter(filter.param, event.target.value || undefined)
            }
          />
        </div>
        {toParam ? (
          <div className="flex min-w-40 flex-col gap-2">
            <Label htmlFor={`filter-${toParam}`}>{toParam}</Label>
            <Input
              id={`filter-${toParam}`}
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
      <Label htmlFor={`filter-${filter.param}`}>{filter.param}</Label>
      <Input
        id={`filter-${filter.param}`}
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
 * Per-instance staff DataTable context: `x-table` meta, injected Orval
 * `queryHook`, first-paint `initialParams`, and optional URL write-back.
 *
 * Use on an internal dashboard list page as the compound root. Do not use on
 * the wholesale shop, do not import Orval or `next/navigation` here, and do
 * not share one Root across two tables.
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
export function DataTableRoot<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
>({
  children,
  ...props
}: DataTableRootProps<TParams, TRow>) {
  const value = useDataTableRootModel(props);
  return (
    <DataTableContext.Provider value={value as DataTableContextValue}>
      <div className="flex flex-col gap-4">{children}</div>
    </DataTableContext.Provider>
  );
}

DataTableRoot.displayName = "DataTable.Root";

/**
 * Search field for the `x-table.search` param (usually `q`).
 *
 * Use inside `DataTable.Root` on staff list pages that declare search. Renders
 * nothing when `meta.search` is absent. Do not use outside a Root.
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
  const { meta, state, setState } = useDataTable();
  if (!meta.search) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="datatable-search">{meta.search.placeholder}</Label>
        <Input
          id="datatable-search"
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
    </div>
  );
}

DataTableSearch.displayName = "DataTable.Search";

/**
 * Declared `x-table` filters plus sort/order chrome.
 *
 * Use inside `DataTable.Root` to render only filters listed on `meta.filters`.
 * Do not invent extra filter widgets, and do not use outside a Root.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   filterOptions={{ status: [{ value: "active", label: "active" }] }}
 * >
 *   <DataTable.Filters />
 * </DataTable.Root>
 * ```
 */
export function DataTableFilters() {
  const { meta, state, setState, filterOptions } = useDataTable();

  const setFilter = (param: string, value: string | boolean | undefined) => {
    setState((current) => ({
      ...current,
      page: 1,
      filters: { ...current.filters, [param]: value },
    }));
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {meta.filters.map((filter) => (
        <FilterControl
          key={filter.param}
          filter={filter}
          state={state}
          setFilter={setFilter}
          options={filterOptions?.[filter.param]}
        />
      ))}
      <div className="flex min-w-40 flex-col gap-2">
        <Label htmlFor="datatable-sort">Sort</Label>
        <select
          id="datatable-sort"
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
        <Label htmlFor="datatable-sort-order">Order</Label>
        <select
          id="datatable-sort-order"
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

DataTableFilters.displayName = "DataTable.Filters";

/**
 * Row grid for the current list page (loading / error / empty / rows).
 *
 * Use inside `DataTable.Root` to render `meta.columns`. Do not join a second
 * inventory hook to compute availability, and do not use outside a Root.
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
  const { meta, state, query, envelope } = useDataTable();
  const items = envelope?.items ?? [];
  const busy = query.isPending === true || query.isLoading === true;

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

DataTableTable.displayName = "DataTable.Table";

/**
 * Previous/next pager bound to the current Root’s page state.
 *
 * Use inside `DataTable.Root` under the table. Do not push a history entry per
 * page click — the page owns URL write-back via `onParamsChange`.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Table />
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export function DataTablePagination() {
  const { state, setState, query, envelope } = useDataTable();
  const total = envelope?.total ?? 0;
  const page = envelope?.page ?? state.page;
  const pageSize = envelope?.pageSize ?? state.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const busy = query.isPending === true || query.isLoading === true;

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

DataTablePagination.displayName = "DataTable.Pagination";

/**
 * Compound staff DataTable: `Root` + `Search` + `Filters` + `Table` +
 * `Pagination`. Each Root is its own React context.
 *
 * Use on internal dashboard list pages with generated `x-table` meta and an
 * injected Orval hook. Do not use on the wholesale shop, and do not let
 * ui-internal own the URL — the page passes `initialParams` and write-back.
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
