"use client";

import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import { DataTable, type ListQueryParams } from "@dc-inventory/ui-internal";
import { replaceTableUrl } from "../lib/table-url-params";
import {
  productStatusFilterOptions,
  productsListTable,
} from "../lib/products-list-table";

type CatalogListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

export function CatalogTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  return (
    <DataTable.Root<CatalogListParams>
      meta={productsListTable}
      queryHook={useListInternalProducts}
      filterOptions={{ status: productStatusFilterOptions }}
      initialParams={initialParams}
      onParamsChange={(params) => replaceTableUrl(productsListTable, params)}
    >
      <DataTable.Search />
      <DataTable.Filters />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
