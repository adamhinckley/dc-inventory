"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  listInternalPurchaseOrdersTable,
  useListInternalPurchaseOrders,
  useSyncInternalPurchaseOrdersFromUncovered,
} from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { purchasing2PurchaseOrderHref } from "../lib/purchasing-2-uncovered-constants";
import { replaceTableUrlParams } from "../lib/table-url-params";

function useDraftPurchaseOrdersList(
  params?: Parameters<typeof useListInternalPurchaseOrders>[0],
) {
  return useListInternalPurchaseOrders({
    ...params,
    status: "draft",
  });
}

function formatLastSyncedAt(value: Date): string {
  return value.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Purchasing2DraftOrdersExplorer({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const queryClient = useQueryClient();
  const syncMutation = useSyncInternalPurchaseOrdersFromUncovered();
  const syncStartedRef = useRef(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    setSyncError(null);
    try {
      const result = await syncMutation.mutateAsync({ data: {} });
      if (result.status !== 200) {
        setSyncError("Could not sync draft purchase orders from uncovered demand.");
        return;
      }
      setLastSyncedAt(new Date());
      await queryClient.invalidateQueries({
        queryKey: getListInternalPurchaseOrdersQueryKey(),
      });
    } catch {
      setSyncError("Could not sync draft purchase orders from uncovered demand.");
    }
  }, [queryClient, syncMutation]);

  useEffect(() => {
    if (syncStartedRef.current) {
      return;
    }
    syncStartedRef.current = true;
    void runSync();
  }, [runSync]);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalPurchaseOrdersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? purchasing2PurchaseOrderHref(row.id) : undefined;
  }, []);

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  const busy = syncMutation.isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <p className="text-body-sm text-fg-secondary">
        Open draft POs refresh from current uncovered demand when this hub loads. Edits
        in the PO editor are kept until the next hub visit.
        {lastSyncedAt
          ? ` Last synced ${formatLastSyncedAt(lastSyncedAt)}.`
          : busy
            ? " Syncing now…"
            : null}
      </p>

      {syncError ? (
        <p className="text-body-sm text-error" role="alert">
          {syncError}
        </p>
      ) : null}

      <DataTable.Root
        meta={listInternalPurchaseOrdersTable}
        queryHook={useDraftPurchaseOrdersList as ListQueryHook<
          Parameters<typeof useListInternalPurchaseOrders>[0]
        >}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        getRowHref={getRowHref}
        linkField="documentNumber"
        renderRowLink={renderRowLink}
        idPrefix="purchasing-2-draft-purchase-orders"
      >
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
    </div>
  );
}
