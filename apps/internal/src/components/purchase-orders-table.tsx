"use client";

import { useListInternalPurchaseOrders } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { draftPurchaseOrdersListTable } from "../lib/draft-purchase-orders-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";

export type PurchaseOrdersList = "draft" | "completed";

function useDraftPurchaseOrdersList(
  params?: Parameters<typeof useListInternalPurchaseOrders>[0],
) {
  return useListInternalPurchaseOrders({
    ...params,
    status: "draft",
  });
}

function useCompletedPurchaseOrdersList(
  params?: Parameters<typeof useListInternalPurchaseOrders>[0],
) {
  return useListInternalPurchaseOrders({
    ...params,
    status: "confirmed",
  });
}

export function PurchaseOrdersTable({
  list,
  initialParams,
}: {
  list: PurchaseOrdersList;
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(draftPurchaseOrdersListTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/purchasing/${row.id}` : undefined;
  }, []);

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  return (
    <DataTable.Root
      meta={draftPurchaseOrdersListTable}
      queryHook={
        (list === "draft"
          ? useDraftPurchaseOrdersList
          : useCompletedPurchaseOrdersList) as ListQueryHook<
          Parameters<typeof useListInternalPurchaseOrders>[0]
        >
      }
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="documentNumber"
      renderRowLink={renderRowLink}
      idPrefix={
        list === "draft" ? "draft-purchase-orders" : "completed-purchase-orders"
      }
    >
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
