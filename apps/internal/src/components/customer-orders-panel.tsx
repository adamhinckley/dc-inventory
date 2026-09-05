"use client";

import { useListInternalSalesOrders } from "@dc-inventory/api-client-internal";
import { Chip } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import { customersOrdersTable } from "../lib/customers-orders-table";
import { salesOrderStatusPresentation } from "../lib/sales-order-status-chip";
import { salesOrderStatusFilterOptions } from "../lib/sales-order-status-filter";
import { replaceTableUrlParams } from "../lib/table-url-params";

type CustomerOrdersListParams = NonNullable<
  Parameters<typeof useListInternalSalesOrders>[0]
>;

export function CustomerOrdersPanel({
  customerId,
  initialParams,
}: {
  customerId: string;
  initialParams?: ListQueryParams;
}) {
  const queryHook: ListQueryHook<CustomerOrdersListParams> = (params) =>
    useListInternalSalesOrders({
      ...params,
      customerId,
    });

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(customersOrdersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/sales/${row.id}` : undefined;
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
    <DataTable.Root<CustomerOrdersListParams>
      meta={customersOrdersTable}
      queryHook={queryHook}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="documentNumber"
      renderRowLink={renderRowLink}
      filterOptions={{ status: salesOrderStatusFilterOptions }}
      filterLabels={{ status: "Status" }}
      emptyMessage="No sales orders yet."
      renderColumns={{
        status: (row) => {
          const presentation = salesOrderStatusPresentation(row.status);
          if (presentation === null) {
            return "—";
          }
          return (
            <Chip
              icon={<Chip.Dot />}
              style={{ "--chip-color": presentation.color } as CSSProperties}
            >
              {presentation.label}
            </Chip>
          );
        },
      }}
      idPrefix="customer-orders"
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
