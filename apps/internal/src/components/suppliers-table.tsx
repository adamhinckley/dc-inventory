"use client";

import { useListInternalSuppliers } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
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

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  return (
    <DataTable.Root<SuppliersListParams>
      meta={suppliersListTable}
      queryHook={useListInternalSuppliers}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="vendorNumber"
      renderRowLink={renderRowLink}
    >
      <DataTable.Search />
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
