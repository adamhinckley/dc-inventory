"use client";

import { useListInternalPurchaseOrders } from "@dc-inventory/api-client-internal";
import { DataTable, type ListQueryParams } from "@dc-inventory/ui-internal";
import { useCallback } from "react";
import { purchaseOrdersListTable } from "../lib/purchase-orders-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";

type PurchaseOrderListParams = NonNullable<
  Parameters<typeof useListInternalPurchaseOrders>[0]
>;

export function PurchaseOrdersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(purchaseOrdersListTable, params);
  }, []);

  return (
    <DataTable.Root<PurchaseOrderListParams>
      meta={purchaseOrdersListTable}
      queryHook={useListInternalPurchaseOrders}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
    >
      <DataTable.Filters />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
