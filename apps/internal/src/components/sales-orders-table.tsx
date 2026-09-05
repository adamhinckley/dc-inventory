"use client";

import {
  listInternalSalesOrdersTable,
  useListInternalSalesOrders,
} from "@dc-inventory/api-client-internal";
import { Chip } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import Link from "next/link";
import { useCallback, type CSSProperties, type ReactNode } from "react";
import { salesCustomerCell } from "../lib/sales-customer-cell";
import { salesOrderStatusPresentation } from "../lib/sales-order-status-chip";
import { salesOrderStatusFilterOptions } from "../lib/sales-order-status-filter";
import { replaceTableUrlParams } from "../lib/table-url-params";

type SalesOrdersListParams = NonNullable<
  Parameters<typeof useListInternalSalesOrders>[0]
>;

export function SalesOrdersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalSalesOrdersTable, params);
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
    <DataTable.Root<SalesOrdersListParams>
      meta={listInternalSalesOrdersTable}
      queryHook={useListInternalSalesOrders as ListQueryHook<SalesOrdersListParams>}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      getRowHref={getRowHref}
      linkField="documentNumber"
      renderRowLink={renderRowLink}
      filterOptions={{ status: salesOrderStatusFilterOptions }}
      filterLabels={{ status: "Status", customerId: "Customer ID" }}
      renderColumns={{
        customerName: (row) => {
          const cell = salesCustomerCell(row);
          if (cell.kind === "dash") {
            return "—";
          }
          return (
            <Link href={cell.href} className="text-link hover:text-link-hover">
              {cell.label}
            </Link>
          );
        },
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
      idPrefix="sales-orders"
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
