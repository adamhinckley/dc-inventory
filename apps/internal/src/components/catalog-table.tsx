"use client";

import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import { DataTable } from "@dc-inventory/ui-internal";
import {
  productStatusFilterOptions,
  productsListTable,
} from "../lib/products-list-table";

export function CatalogTable() {
  return (
    <DataTable
      meta={productsListTable}
      queryHook={useListInternalProducts}
      filterOptions={{ status: productStatusFilterOptions }}
    />
  );
}
