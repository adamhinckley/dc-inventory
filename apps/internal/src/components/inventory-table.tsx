"use client";

import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import { DataTable, type ListQueryParams } from "@dc-inventory/ui-internal";
import { useCallback } from "react";
import { inventoryListTable } from "../lib/inventory-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";

type InventoryListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

export function InventoryTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(inventoryListTable, params);
  }, []);

  return (
    <DataTable.Root<InventoryListParams>
      meta={inventoryListTable}
      queryHook={useListInternalProducts}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      filterLabels={{ hideZeroInventory: "Hide empty inventory" }}
    >
      <DataTable.Toolbar>
        <DataTable.Search />
        <DataTable.Filters />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
