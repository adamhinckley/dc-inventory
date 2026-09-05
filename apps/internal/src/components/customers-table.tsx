"use client";

import {
  listInternalCustomersTable,
  useListInternalCustomers,
} from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import {
  customerListAccountStatusLabel,
} from "../lib/customer-account-status";
import { customerAccountStatusFilterOptions } from "../lib/customer-account-status-filter";
import type { CustomerAccountStatus } from "../lib/customer-types";
import { replaceTableUrlParams } from "../lib/table-url-params";

type CustomersListParams = NonNullable<
  Parameters<typeof useListInternalCustomers>[0]
>;

export function CustomersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalCustomersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/customers/${row.id}` : undefined;
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
    <DataTable.Root<CustomersListParams>
      meta={listInternalCustomersTable}
      queryHook={useListInternalCustomers}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="name"
      renderRowLink={renderRowLink}
      filterOptions={{ accountStatus: customerAccountStatusFilterOptions }}
      filterLabels={{ accountStatus: "Status" }}
      emptyMessage="No customers yet."
      renderColumns={{
        accountStatus: (row) =>
          customerListAccountStatusLabel(
            row.accountStatus as CustomerAccountStatus,
          ),
      }}
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
