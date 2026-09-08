"use client";

import {
  getListInternalProductsQueryKey,
  useReopenInternalInventorySkus,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import {
  listParamsFromState,
  useDataTableContext,
} from "@dc-inventory/ui-internal";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildInventoryReopenCommand,
  fetchInventoryMatchPages,
  fetchRemainingInventoryMatches,
  inventoryReopenQueryKey,
  shouldPrefetchInventoryMatches,
  type InventoryMatchRow,
} from "../lib/inventory-reopen-workflow";
import { inventoryListTable } from "../lib/inventory-list-table";
import { VirtualRows } from "./inventory-reopen/virtual-rows";
import { WindowFields } from "./inventory-reopen/window-fields";

function inventoryFilterParams(state: ReturnType<typeof useDataTableContext>["state"]) {
  const params = listParamsFromState(inventoryListTable, state);
  delete params.page;
  delete params.pageSize;
  return params;
}

export function InventoryReopenReview() {
  const queryClient = useQueryClient();
  const applyingRef = useRef(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);
  const reopenMutation = useReopenInternalInventorySkus();
  const { state } = useDataTableContext();

  const filterParams = useMemo(() => inventoryFilterParams(state), [state]);
  const matchesQuery = useInfiniteQuery({
    queryKey: inventoryReopenQueryKey(filterParams),
    queryFn: ({ pageParam }) => fetchInventoryMatchPages(filterParams, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });
  const matching = useMemo(
    () => matchesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [matchesQuery.data],
  );
  const matchCount = matchesQuery.data?.pages[0]?.total ?? 0;
  const nextPage = matchesQuery.data?.pages.at(-1)?.nextPage ?? null;

  const onVisibleRange = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (
        !matchesQuery.hasNextPage ||
        matchesQuery.isFetchingNextPage ||
        matchesQuery.isFetchNextPageError ||
        !shouldPrefetchInventoryMatches({
          loadedCount: matching.length,
          total: matchCount,
          visibleIndex: range.endIndex,
        })
      ) {
        return;
      }
      void matchesQuery.fetchNextPage();
    },
    [
      matchCount,
      matching.length,
      matchesQuery.fetchNextPage,
      matchesQuery.hasNextPage,
      matchesQuery.isFetchNextPageError,
      matchesQuery.isFetchingNextPage,
    ],
  );

  async function applyReopen() {
    if (applyingRef.current || matchCount === 0) {
      return;
    }
    applyingRef.current = true;
    setActionError(null);
    setLastAppliedCount(null);
    try {
      const remaining =
        nextPage === null
          ? []
          : await fetchRemainingInventoryMatches(filterParams, nextPage);
      const command = buildInventoryReopenCommand(
        [...matching, ...remaining],
        opensAt,
        closesAt,
        filterParams,
      );
      const result = await reopenMutation.mutateAsync({ data: command });
      if (result.status !== 200) {
        setActionError("Could not reopen matching SKUs.");
        return;
      }
      setLastAppliedCount(result.data.reopenedCount);
      void queryClient.invalidateQueries({ queryKey: getListInternalProductsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: inventoryReopenQueryKey(filterParams) });
    } catch {
      setActionError("Could not load matching SKUs for reopen.");
    } finally {
      applyingRef.current = false;
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-form-section"
      data-testid="inventory-reopen-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-field-group">
        <div className="min-w-0">
          <h2 className="text-heading-sm">Manage Pre-Sell</h2>
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
            size="sm"
            disabled={
              reopenMutation.isPending ||
              matchesQuery.isPending ||
              matchCount === 0 ||
              closesAt.trim() === ""
            }
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
          ? "Loading matches…"
          : `${matchCount.toLocaleString()} matching SKU(s) for the current filter.`}
        {state.search.trim() !== "" ? ` Search: “${state.search.trim()}”.` : ""}
      </p>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-section border border-border">
        <div className="grid shrink-0 grid-cols-[8rem_minmax(0,1fr)_10rem_6rem_5rem_5rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
          <span>SKU</span>
          <span>Name</span>
          <span>Factory</span>
          <span>State</span>
          <span>On Hand</span>
          <span>On Order</span>
        </div>
        {matchesQuery.isError ? (
          <p className="px-3 py-4 text-body-sm text-error" role="alert">
            Could not load matches.
          </p>
        ) : (
          <VirtualRows
            items={matching}
            estimateSize={36}
            className="h-[min(36rem,calc(100dvh-18rem))] overflow-auto"
            onVisibleRange={onVisibleRange}
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
    <div className="grid h-full grid-cols-[8rem_minmax(0,1fr)_10rem_6rem_5rem_5rem] items-center gap-x-3 border-b border-border px-3 text-body-sm">
      <span className="font-mono">{row.sku}</span>
      <span className="truncate">{row.name}</span>
      <span className="truncate">{row.supplierName ?? ""}</span>
      <span>{row.sellState}</span>
      <span>{row.onHand}</span>
      <span>{row.onOrder}</span>
    </div>
  );
}
