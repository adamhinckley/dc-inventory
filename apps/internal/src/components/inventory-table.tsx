"use client";

import {
  getListInternalProductsQueryKey,
  useListInternalProducts,
  useReopenInternalInventorySkus,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import {
  DataTable,
  listParamsFromState,
  useDataTableContext,
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

const useInventoryListProducts: ListQueryHook<InventoryListParams> = (params) =>
  useListInternalProducts(
    inventoryListQueryParams(params) as InventoryListParams,
  );

function inventoryFilterParams(state: ReturnType<typeof useDataTableContext>["state"]) {
  const params = listParamsFromState(inventoryListTable, state);
  delete params.page;
  delete params.pageSize;
  return params;
}

export function InventoryTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(inventoryListTable, params);
  }, []);

  return (
    <DataTable.Root
      meta={inventoryListTable}
      queryHook={useInventoryListProducts}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      filterLabels={{ hideZeroInventory: "Hide empty inventory" }}
    >
      <DataTable.Toolbar>
        <DataTable.Search />
        <DataTable.Filters />
      </DataTable.Toolbar>
      <InventoryReopenReview />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}

function InventoryReopenReview() {
  const queryClient = useQueryClient();
  const applyingRef = useRef(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);
  const reopenMutation = useReopenInternalInventorySkus();
  const { state } = useDataTableContext();

  const filterParams = useMemo(() => inventoryFilterParams(state), [state]);
  const matchesQuery = useQuery({
    queryKey: inventoryReopenQueryKey(filterParams),
    queryFn: () => fetchAllInventoryMatches(filterParams),
  });
  const matching = matchesQuery.data ?? [];
  const matchCount = matching.length;

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
