"use client";

import {
  listInternalProductsTable,
  useListInternalProducts,
} from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useCallback } from "react";
import { replaceTableUrlParams } from "../lib/table-url-params";

type CatalogListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

export function CatalogTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalProductsTable, params);
  }, []);

  return (
    <DataTable.Root<CatalogListParams>
      meta={listInternalProductsTable}
      queryHook={useListInternalProducts}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
    >
      <DataTable.Search />
      <DataTable.Filters />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
