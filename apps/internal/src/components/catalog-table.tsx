"use client";

import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import { DataTable } from "@dc-inventory/ui-internal";
import {
  productStatusFilterOptions,
  productsListTable,
} from "../lib/products-list-table";

type CatalogListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

export function CatalogTable() {
  return (
    <DataTable<CatalogListParams>
      meta={productsListTable}
      queryHook={useListInternalProducts}
      filterOptions={{ status: productStatusFilterOptions }}
    />
  );
}
