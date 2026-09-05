"use client";

import {
  getListInternalProductsQueryKey,
  useListInternalProducts,
  useReopenInternalInventorySkus,
} from "@dc-inventory/api-client-internal";
import { Button, Table, useTable, type TableColumnDef } from "@dc-inventory/ui";
import {
  listParamsFromState,
  useDataTable,
  type DataTableState,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildInventoryReopenCommand,
  fetchAllInventoryMatches,
  inventoryReopenQueryKey,
  type InventoryMatchRow,
} from "../lib/inventory-reopen-workflow";
import {
  inventoryListQueryParams,
  inventoryListTable,
} from "../lib/inventory-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { VirtualRows } from "./inventory-reopen/virtual-rows";
import { WindowFields } from "./inventory-reopen/window-fields";

type InventoryListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

type InventoryRow = Record<string, unknown> & {
  sku: string;
  name: string;
  sellState: string;
  onHand: number;
  onOrder: number;
};

const useInventoryListProducts: ListQueryHook<InventoryListParams, InventoryRow> = (params) =>
  useListInternalProducts(
    inventoryListQueryParams(params) as InventoryListParams,
  );

function inventoryFilterParams(state: DataTableState): ListQueryParams {
  const params = listParamsFromState(inventoryListTable, state);
  delete params.page;
  delete params.pageSize;
  return params;
}

function formatCell(row: InventoryRow, field: string): string {
  const value = row[field as keyof InventoryRow];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

export function InventoryTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const queryClient = useQueryClient();
  const applyingRef = useRef(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);
  const reopenMutation = useReopenInternalInventorySkus();

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(inventoryListTable, params);
  }, []);

  const { items, query, state, setState, total, page, pageSize, pageCount } = useDataTable({
    meta: inventoryListTable,
    queryHook: useInventoryListProducts,
    initialParams,
    onParamsChange,
  });

  const filterParams = useMemo(() => inventoryFilterParams(state), [state]);
  const matchesQuery = useQuery({
    queryKey: inventoryReopenQueryKey(filterParams),
    queryFn: () => fetchAllInventoryMatches(filterParams),
  });
  const matching = matchesQuery.data ?? [];
  const matchCount = matching.length;

  const columns = useMemo<TableColumnDef<InventoryRow>[]>(
    () =>
      inventoryListTable.columns.map((column) => ({
        id: column.field,
        label: column.label,
        sort:
          inventoryListTable.sort?.fields.includes(column.field) === true
            ? column.field
            : (false as const),
        align:
          column.field === "sku" || column.field === "name" || column.field === "sellState"
            ? "left"
            : "right",
        truncate: column.field === "sku" || column.field === "name",
        render: ({ record }) => formatCell(record, column.field),
      })),
    [],
  );

  const table = useTable({
    data: items as InventoryRow[],
    isPending: query.isPending === true || query.isLoading === true,
    isError: query.isError === true,
    columns,
    getRowId: (row) => row.sku,
    fillColumn: "sku",
    enableSorting: true,
    enablePagination: true,
    pagination: {
      page: Math.max(0, page - 1),
      pageSize,
      totalRows: total,
      canPreviousPage: page > 1,
      canNextPage: page < pageCount,
    },
    onPaginationChange: (action) => {
      setState((current) => {
        if (action.type === "next") {
          return { ...current, page: current.page + 1 };
        }
        if (action.type === "previous") {
          return { ...current, page: Math.max(1, current.page - 1) };
        }
        return { ...current, page: 1, pageSize: action.pageSize };
      });
    },
    onSortChange: (next) => {
      const sortBy = next.field;
      if (sortBy === null) {
        return;
      }
      setState((current) => ({
        ...current,
        page: 1,
        sortBy,
        sortOrder: next.direction,
      }));
    },
  });

  async function applyReopen() {
    if (applyingRef.current || matchCount === 0) {
      return;
    }
    applyingRef.current = true;
    setActionError(null);
    setLastAppliedCount(null);
    try {
      const command = buildInventoryReopenCommand(matching, opensAt, closesAt);
      const result = await reopenMutation.mutateAsync({ data: command });
      if (result.status !== 200) {
        setActionError("Could not reopen matching SKUs.");
        return;
      }
      setLastAppliedCount(result.data.reopenedCount);
      void queryClient.invalidateQueries({ queryKey: getListInternalProductsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: inventoryReopenQueryKey(filterParams) });
    } finally {
      applyingRef.current = false;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <section
        className="flex shrink-0 flex-col gap-form-section rounded-section border border-border bg-surface-card p-form-section"
        data-testid="inventory-reopen-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-field-group">
          <div className="min-w-0">
            <h2 className="text-heading-sm">Reopen For Pre-Sell</h2>
            <p className="text-body-sm text-fg-secondary">
              Current inventory filters define the match set. Review every matching SKU,
              then reopen that set with one optional shared sell window.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-tight">
            <WindowFields
              opensAt={opensAt}
              closesAt={closesAt}
              onOpensAt={setOpensAt}
              onClosesAt={setClosesAt}
            />
            <Button
              type="button"
              variant="primary"
              disabled={reopenMutation.isPending || matchesQuery.isPending || matchCount === 0}
              onClick={() => {
                void applyReopen();
              }}
              data-testid="inventory-reopen-apply"
            >
              <RotateCcw className="size-icon" aria-hidden />
              Reopen {matchCount.toLocaleString()} Matching
            </Button>
          </div>
        </div>

        {actionError ? (
          <p className="text-body-sm text-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {lastAppliedCount !== null ? (
          <p className="text-body-sm text-fg-secondary" role="status">
            Reopened {lastAppliedCount.toLocaleString()} SKU(s).
          </p>
        ) : null}

        <p className="text-body-sm text-fg-secondary">
          {matchesQuery.isPending
            ? "Loading full match set…"
            : `${matchCount.toLocaleString()} matching SKU(s) for the current filter.`}
          {state.search.trim() !== "" ? ` Search: “${state.search.trim()}”.` : ""}
        </p>

        <div className="min-h-0 overflow-hidden rounded-section border border-border">
          <div className="grid grid-cols-[8rem_1fr_6rem_5rem_5rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
            <span>SKU</span>
            <span>Name</span>
            <span>State</span>
            <span>On Hand</span>
            <span>On Order</span>
          </div>
          {matchesQuery.isError ? (
            <p className="px-3 py-4 text-body-sm text-error" role="alert">
              Could not load the full match set.
            </p>
          ) : (
            <VirtualRows
              items={matching}
              estimateSize={36}
              className="h-[min(24rem,calc(100dvh-28rem))] overflow-auto"
            >
              {(row) => <InventoryMatchRow row={row} />}
            </VirtualRows>
          )}
        </div>
      </section>

      <InventoryBrowseTable
        state={state}
        setState={setState}
        table={table}
      />
    </div>
  );
}

function InventoryMatchRow({ row }: { row: InventoryMatchRow }) {
  return (
    <div className="grid h-full grid-cols-[8rem_1fr_6rem_5rem_5rem] items-center gap-x-3 border-b border-border px-3 text-body-sm">
      <span className="font-mono">{row.sku}</span>
      <span className="truncate">{row.name}</span>
      <span>{row.sellState}</span>
      <span>{row.onHand}</span>
      <span>{row.onOrder}</span>
    </div>
  );
}

function InventoryBrowseTable({
  state,
  setState,
  table,
}: {
  state: DataTableState;
  setState: ReturnType<typeof useDataTable>["setState"];
  table: ReturnType<typeof useTable<InventoryRow>>;
}) {
  const searchId = "inventory-table-search";
  const hideEmptyId = "inventory-table-hide-empty";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <div className="flex flex-wrap items-end gap-field-group">
        <label className="flex w-52 shrink-0 flex-col gap-field" htmlFor={searchId}>
          <span className="text-label text-fg-secondary">Search</span>
          <input
            id={searchId}
            className="min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y text-input"
            placeholder={inventoryListTable.search?.placeholder ?? "Search"}
            value={state.search}
            onChange={(event) => {
              setState((current) => ({
                ...current,
                page: 1,
                search: event.target.value,
              }));
            }}
          />
        </label>
        <label className="flex items-center gap-tight text-body-sm">
          <input
            id={hideEmptyId}
            type="checkbox"
            checked={state.filters.hideZeroInventory === true}
            onChange={(event) => {
              setState((current) => ({
                ...current,
                page: 1,
                filters: {
                  ...current.filters,
                  hideZeroInventory: event.target.checked ? true : undefined,
                },
              }));
            }}
          />
          Hide empty inventory
        </label>
      </div>

      <Table sticky className="min-h-0 flex-1" table={table} emptyMessage="No inventory rows">
        <Table.Header />
        <Table.Body />
        <Table.Empty />
        <Table.Pagination />
      </Table>
    </div>
  );
}
