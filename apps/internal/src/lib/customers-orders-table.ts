import { listInternalSalesOrdersTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

const CUSTOMER_ORDERS_SORT_FIELDS = ["documentNumber", "status"] as const;

/**
 * Sales orders on customer detail. Same Orval hook as /sales, scoped to one
 * customer: no Customer column, no customerId filter, newest SO # first.
 */
export const customersOrdersTable = {
  rowId: listInternalSalesOrdersTable.rowId,
  columns: [
    { field: "documentNumber", label: "SO #" },
    { field: "status", label: "Status" },
  ],
  search: listInternalSalesOrdersTable.search,
  filters: listInternalSalesOrdersTable.filters?.filter(
    (filter) => filter.param !== "customerId",
  ),
  sort: {
    defaultBy: "documentNumber",
    defaultOrder: "desc",
    fields: [...CUSTOMER_ORDERS_SORT_FIELDS],
  },
} as const satisfies TableMeta;
