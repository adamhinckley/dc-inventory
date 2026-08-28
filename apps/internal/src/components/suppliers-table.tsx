"use client";

import { useListInternalSuppliers } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useCallback } from "react";
import { suppliersListTable } from "../lib/suppliers-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";

type SuppliersListParams = NonNullable<
  Parameters<typeof useListInternalSuppliers>[0]
>;

export function SuppliersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(suppliersListTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/purchasing/suppliers/${row.id}` : undefined;
  }, []);

  return (
    <DataTable.Root<SuppliersListParams>
      meta={suppliersListTable}
      queryHook={useListInternalSuppliers}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="vendorNumber"
    >
      <DataTable.Search />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
