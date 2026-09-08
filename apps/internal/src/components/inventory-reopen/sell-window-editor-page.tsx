"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getGetInternalSellWindowQueryKey,
  getListInternalProductsQueryKey,
  getListInternalSellWindowsQueryKey,
  useGetInternalSellWindow,
  useReopenInternalInventorySkus,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  FieldRow,
  LabeledField,
  Label,
  TextInput,
} from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSellWindowOpenCommand,
  fetchInventoryMatchPages,
  fetchRemainingInventoryMatches,
  filterSnapshotToListParams,
  instantToDateInput,
  inventoryReopenQueryKey,
  isEligibleForSellWindowApply,
  shouldPrefetchInventoryMatches,
} from "../../lib/inventory-reopen-workflow";
import { useProductListFilterOptions } from "../../lib/use-product-list-filter-options";
import { FilterControls } from "./filter-controls";
import { SkuReviewTable } from "./sku-review-table";
import { WindowFields } from "./window-fields";

export function SellWindowEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const cloneFrom = searchParams.get("clone");
  const cloneQuery = useGetInternalSellWindow(cloneFrom ?? "", {
    query: {
      enabled: cloneFrom !== null && cloneFrom !== "",
      queryKey: getGetInternalSellWindowQueryKey(cloneFrom ?? ""),
    },
  });
  const reopenMutation = useReopenInternalInventorySkus();
  const filterOptions = useProductListFilterOptions();
  const applyingRef = useRef(false);
  const cloneAppliedRef = useRef<string | null>(null);

  const [windowName, setWindowName] = useState("");
  const [filters, setFilters] = useState<ListQueryParams>({});
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [checkedSkus, setCheckedSkus] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (cloneFrom === null || cloneFrom === "") {
      return;
    }
    if (cloneQuery.data?.status !== 200) {
      return;
    }
    if (cloneAppliedRef.current === cloneFrom) {
      return;
    }
    const source = cloneQuery.data.data;
    cloneAppliedRef.current = cloneFrom;
    setWindowName(`Copy of ${source.name}`);
    setFilters(filterSnapshotToListParams(source.filterSnapshot));
    setOpensAt(instantToDateInput(source.windowOpensAt));
    setClosesAt(instantToDateInput(source.windowClosesAt));
    setCheckedSkus({});
  }, [cloneFrom, cloneQuery.data]);

  const matchesQuery = useInfiniteQuery({
    queryKey: inventoryReopenQueryKey(filters),
    queryFn: ({ pageParam }) => fetchInventoryMatchPages(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });
  const matching = useMemo(
    () => matchesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [matchesQuery.data],
  );
  const matchCount = matchesQuery.data?.pages[0]?.total ?? 0;
  const nextPage = matchesQuery.data?.pages.at(-1)?.nextPage ?? null;

  useEffect(() => {
    if (matching.length === 0) {
      return;
    }
    setCheckedSkus((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of matching) {
        if (!(row.sku in next) && isEligibleForSellWindowApply(row)) {
          next[row.sku] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [matching]);

  const eligibleCheckedCount = useMemo(
    () =>
      matching.filter(
        (row) => isEligibleForSellWindowApply(row) && checkedSkus[row.sku] !== false,
      ).length,
    [checkedSkus, matching],
  );
  const eligibleCount = useMemo(
    () => matching.filter(isEligibleForSellWindowApply).length,
    [matching],
  );

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

  function toggleSku(sku: string, checked: boolean) {
    setCheckedSkus((current) => ({ ...current, [sku]: checked }));
  }

  function selectAllEligible() {
    setCheckedSkus((current) => {
      const next = { ...current };
      for (const row of matching) {
        if (isEligibleForSellWindowApply(row)) {
          next[row.sku] = true;
        }
      }
      return next;
    });
  }

  async function applyOpenInfinity() {
    if (applyingRef.current) {
      return;
    }
    applyingRef.current = true;
    setActionError(null);
    try {
      const remaining =
        nextPage === null
          ? []
          : await fetchRemainingInventoryMatches(filters, nextPage);
      const allRows = [...matching, ...remaining];
      const selectedSkus = allRows
        .filter(
          (row) => isEligibleForSellWindowApply(row) && checkedSkus[row.sku] !== false,
        )
        .map((row) => row.sku);
      const command = buildSellWindowOpenCommand({
        name: windowName,
        filterParams: filters,
        checkedSkus: selectedSkus,
        opensAt,
        closesAt,
      });
      const result = await reopenMutation.mutateAsync({ data: command });
      if (result.status !== 200) {
        setActionError("Could not open infinity for the selected SKUs.");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: getListInternalProductsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListInternalSellWindowsQueryKey() });
      void queryClient.invalidateQueries({
        queryKey: getGetInternalSellWindowQueryKey(result.data.sellWindowId),
      });
      router.push("/inventory/reopen");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not open infinity for the selected SKUs.",
      );
    } finally {
      applyingRef.current = false;
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-form-section"
      data-testid="sell-window-editor"
    >
      <nav className="text-body-sm text-fg-secondary">
        <Link href="/inventory/reopen" className="hover:underline">
          Sell Windows
        </Link>
        <span aria-hidden> / </span>
        <span className="text-fg">New sell window</span>
      </nav>

      <div>
        <h2 className="text-heading-sm">New sell window</h2>
        <p className="text-body-sm text-fg-secondary">
          Choose categories and factories, set open/close dates, then review SKUs before opening
          infinity.
        </p>
      </div>

      <LabeledField className="max-w-md">
        <Label htmlFor="window-name">Window name</Label>
        <TextInput
          id="window-name"
          density="compact"
          value={windowName}
          onChange={setWindowName}
        />
      </LabeledField>

      <WindowFields
        opensAt={opensAt}
        closesAt={closesAt}
        onOpensAt={setOpensAt}
        onClosesAt={setClosesAt}
      />

      <section className="flex flex-col gap-field-group">
        <h3 className="text-label text-fg-secondary">Match SKUs</h3>
        <FilterControls
          filters={filters}
          onChange={setFilters}
          categoryOptions={filterOptions.category}
          supplierOptions={filterOptions.supplierId}
        />
      </section>

      <div className="flex flex-wrap items-center gap-tight">
        <Button type="button" variant="secondary" size="sm" onClick={selectAllEligible}>
          Select All Eligible
        </Button>
        <span className="text-body-sm text-fg-secondary">
          {eligibleCheckedCount.toLocaleString()} of {eligibleCount.toLocaleString()} eligible
          checked (inactive and discontinued are skipped on apply)
        </span>
      </div>

      {matchesQuery.isError ? (
        <p className="text-body-sm text-error" role="alert">
          Could not load matches.
        </p>
      ) : (
        <SkuReviewTable
          items={matching}
          checkedSkus={checkedSkus}
          onToggle={toggleSku}
          onVisibleRange={onVisibleRange}
        />
      )}

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <FieldRow>
        <Button
          type="button"
          variant="primary"
          disabled={
            reopenMutation.isPending ||
            matchesQuery.isPending ||
            closesAt.trim() === "" ||
            windowName.trim() === "" ||
            eligibleCheckedCount === 0
          }
          onClick={() => {
            void applyOpenInfinity();
          }}
          data-testid="sell-window-save"
        >
          <Save className="size-icon" aria-hidden />
          Save
        </Button>
      </FieldRow>
    </section>
  );
}
