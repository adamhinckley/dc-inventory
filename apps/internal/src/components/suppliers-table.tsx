"use client";

import { useListInternalSuppliers } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(suppliersListTable, params);
  }, []);

  const onRowClick = useCallback(
    (row: { id?: string }) => {
      if (row.id) {
        router.push(`/purchasing/suppliers/${row.id}`);
      }
    },
    [router],
  );

  return (
    <DataTable.Root<SuppliersListParams>
      meta={suppliersListTable}
      queryHook={useListInternalSuppliers}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      onRowClick={onRowClick}
    >
      <DataTable.Search />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
