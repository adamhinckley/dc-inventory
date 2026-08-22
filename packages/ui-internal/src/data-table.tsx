"use client";

import { Button, Input, Label } from "@dc-inventory/ui";
import { useMemo, useState, type ReactNode } from "react";
import {
  defaultTableState,
  listParamsFromState,
  type DataTableState,
  type ListQueryParams,
} from "./list-params";
import type { TableFilterMeta, TableMeta } from "./table-meta";

export type ListEnvelope<TRow> = {
  items: TRow[];
  page: number;
  pageSize: number;
  total: number;
};

/** Orval query result wraps the list envelope in `{ data, status }`. */
export type OrvalListResponse<TRow> = {
  data: ListEnvelope<TRow>;
  status: number;
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

export type DataTableProps<TParams = ListQueryParams, TRow = Record<string, unknown>> = {
  meta: TableMeta;
  queryHook: ListQueryHook<TParams, TRow>;
  /** Option lists for `select` filters that already exist on `meta.filters`. */
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>;
};

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
}: {
  filter: TableFilterMeta;
  state: DataTableState;
  setState: (next: DataTableState) => void;
  options: readonly FilterOption[] | undefined;
}) {
  const setFilter = (param: string, value: string | boolean | undefined) => {
    setState({
      ...state,
      page: 1,
      filters: { ...state.filters, [param]: value },
    });
  };

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

export function DataTable<TParams = ListQueryParams, TRow = Record<string, unknown>>({
  meta,
  queryHook,
  filterOptions,
}: DataTableProps<TParams, TRow>) {
  const [state, setState] = useState<DataTableState>(() => defaultTableState(meta));
  const params = useMemo(
    () => listParamsFromState(meta, state) as TParams,
    [meta, state],
  );
  const query = queryHook(params);
  const envelope = unwrapListData(query.data);
  const items = envelope?.items ?? [];
  const total = envelope?.total ?? 0;
  const page = envelope?.page ?? state.page;
  const pageSize = envelope?.pageSize ?? state.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const busy = query.isPending === true || query.isLoading === true;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        {meta.search ? (
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <Label htmlFor="datatable-search">{meta.search.placeholder}</Label>
            <Input
              id="datatable-search"
              value={state.search}
              placeholder={meta.search.placeholder}
              onChange={(event) =>
                setState({ ...state, page: 1, search: event.target.value })
              }
            />
          </div>
        ) : null}
        {meta.filters.map((filter) => (
          <FilterControl
            key={filter.param}
            filter={filter}
            state={state}
            setState={setState}
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
              setState({ ...state, page: 1, sortBy: event.target.value })
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
              setState({
                ...state,
                page: 1,
                sortOrder: event.target.value === "desc" ? "desc" : "asc",
              })
            }
          >
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border-subtle">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-layer-01 text-secondary">
            <tr>
              {meta.columns.map((column) => (
                <th
                  key={column.field}
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

      <div className="flex items-center justify-between gap-4 text-sm text-secondary">
        <p className="tabular-nums">
          Page {page} of {pageCount} · {total} rows
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setState({ ...state, page: Math.max(1, state.page - 1) })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setState({ ...state, page: state.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
