"use client";

import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useCallback, type ReactNode } from "react";
import {
  inventoryListQueryParams,
  inventoryListTable,
} from "../lib/inventory-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { useProductListFilterOptions } from "../lib/use-product-list-filter-options";

type InventoryListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

const useInventoryListProducts: ListQueryHook<InventoryListParams> = (params) =>
  useListInternalProducts(
    inventoryListQueryParams(params) as InventoryListParams,
  );

export function InventoryTableChrome({
  initialParams,
  children,
}: {
  initialParams?: ListQueryParams;
  children: ReactNode;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(inventoryListTable, params);
  }, []);
  const filterOptions = useProductListFilterOptions();

  return (
    <DataTable.Root
      meta={inventoryListTable}
      queryHook={useInventoryListProducts}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      filterOptions={filterOptions}
      filterLabels={{
        hideZeroInventory: "Hide empty inventory",
        inactive: "Inactive",
        category: "Category",
        supplierId: "Factory",
        sellState: "Sell state",
      }}
    >
      <DataTable.Toolbar>
        <DataTable.FilterBar resource="Product" />
      </DataTable.Toolbar>
      {children}
    </DataTable.Root>
  );
}

export function InventoryStockTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  return (
    <InventoryTableChrome initialParams={initialParams}>
      <DataTable.Table />
      <DataTable.Pagination />
    </InventoryTableChrome>
  );
}
