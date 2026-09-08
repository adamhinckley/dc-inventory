"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getGetInternalSellWindowQueryKey,
  getListInternalProductsQueryKey,
  getListInternalSellWindowsQueryKey,
  useCloseInternalInventorySkus,
  useGetInternalSellWindow,
} from "@dc-inventory/api-client-internal";
import { Button, FieldRow, buttonVariants, cn, formatDate, formatDateTime } from "@dc-inventory/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Lock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  enrichSellWindowSkuRows,
  filterSnapshotToListParams,
  instantToDateInput,
  sellWindowReadOnly,
  sellWindowSkuRowsQueryKey,
} from "../../lib/inventory-reopen-workflow";
import { useProductListFilterOptions } from "../../lib/use-product-list-filter-options";
import { FilterControls } from "./filter-controls";
import { SkuReviewTable } from "./sku-review-table";
import { WindowFields } from "./window-fields";
import { WindowStatusChip } from "./window-status-chip";

export function SellWindowDetailPage({ windowId }: { windowId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const windowQuery = useGetInternalSellWindow(windowId);
  const closeMutation = useCloseInternalInventorySkus();
  const filterOptions = useProductListFilterOptions();
  const closingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const window =
    windowQuery.data?.status === 200 ? windowQuery.data.data : null;
  const readOnly = window ? sellWindowReadOnly(window) : true;
  const filterParams = useMemo(
    () => (window ? filterSnapshotToListParams(window.filterSnapshot) : {}),
    [window],
  );
  const skuRowsQuery = useQuery({
    queryKey: sellWindowSkuRowsQueryKey(windowId, window?.skus ?? []),
    queryFn: () => enrichSellWindowSkuRows(window!.skus, filterParams),
    enabled: window !== null,
  });
  const displayRows = skuRowsQuery.data ?? [];
  const checkedSkus = useMemo(
    () => Object.fromEntries((window?.skus ?? []).map((sku) => [sku, true])),
    [window?.skus],
  );

  useEffect(() => {
    if (windowQuery.data?.status === 404) {
      router.replace("/inventory/reopen");
    }
  }, [router, windowQuery.data?.status]);

  async function applyCloseInfinity() {
    if (window === null || closingRef.current || readOnly) {
      return;
    }
    closingRef.current = true;
    setActionError(null);
    try {
      const result = await closeMutation.mutateAsync({
        data: {
          windowId: window.id,
          skus: window.skus,
        },
      });
      if (result.status !== 200) {
        setActionError("Could not close infinity for this window.");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: getListInternalProductsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListInternalSellWindowsQueryKey() });
      void queryClient.invalidateQueries({
        queryKey: getGetInternalSellWindowQueryKey(window.id),
      });
      router.push("/inventory/reopen");
    } catch {
      setActionError("Could not close infinity for this window.");
    } finally {
      closingRef.current = false;
    }
  }

  if (windowQuery.isPending) {
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-form-section">
        <p className="text-body-sm text-fg-secondary">Loading sell window…</p>
      </section>
    );
  }

  if (windowQuery.data?.status === 404) {
    return null;
  }

  if (window === null) {
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-form-section">
        <p className="text-body-sm text-error" role="alert">
          Could not load sell window.
        </p>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-form-section"
      data-testid="sell-window-detail"
    >
      <nav className="text-body-sm text-fg-secondary">
        <Link href="/inventory/reopen" className="hover:underline">
          Sell Windows
        </Link>
        <span aria-hidden> / </span>
        <span className="text-fg">{window.name}</span>
      </nav>

      <div>
        <h2 className="text-heading-sm">{window.name}</h2>
        <div className="mt-tight flex flex-wrap items-center gap-tight">
          <WindowStatusChip status={window.status} />
          <span className="text-body-sm text-fg-secondary">
            Applied {formatDateTime(window.appliedAt)}
            {readOnly ? " · read-only" : ""}
          </span>
        </div>
      </div>

      <WindowFields
        opensAt={instantToDateInput(window.windowOpensAt)}
        closesAt={instantToDateInput(window.windowClosesAt)}
        onOpensAt={() => {}}
        onClosesAt={() => {}}
        readOnly
      />

      <section className="flex flex-col gap-field-group">
        <h3 className="text-label text-fg-secondary">Saved filters</h3>
        <FilterControls
          filters={filterParams}
          onChange={() => {}}
          categoryOptions={filterOptions.category}
          supplierOptions={filterOptions.supplierId}
          readOnly
        />
      </section>

      <p className="text-body-sm text-fg-secondary">
        {window.skuCount.toLocaleString()} SKU(s) in this window.
        {window.windowOpensAt ? ` Opens ${formatDate(window.windowOpensAt)}.` : ""}
        {` Closes ${formatDate(window.windowClosesAt)}.`}
      </p>

      {skuRowsQuery.isError ? (
        <p className="text-body-sm text-error" role="alert">
          Could not load window SKUs.
        </p>
      ) : (
        <SkuReviewTable
          items={displayRows}
          checkedSkus={checkedSkus}
          onToggle={() => {}}
          readOnly
        />
      )}

      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <FieldRow>
        {!readOnly ? (
          <Button
            type="button"
            variant="primary"
            disabled={closeMutation.isPending || window.skus.length === 0}
            onClick={() => {
              void applyCloseInfinity();
            }}
            data-testid="sell-window-close"
          >
            <Lock className="size-icon" aria-hidden />
            Close Infinity
          </Button>
        ) : null}
        {readOnly ? (
          <Link
            href={`/inventory/reopen/new?clone=${window.id}`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            <Copy className="size-icon" aria-hidden />
            Clone Window
          </Link>
        ) : null}
      </FieldRow>
    </section>
  );
}
