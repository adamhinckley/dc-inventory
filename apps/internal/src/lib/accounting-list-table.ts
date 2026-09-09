import {
  listInternalAccountingCustomerBalancesTable,
  listInternalAccountingPaymentsTable,
} from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

/** Balances grid: customer name embeds #; drop duplicate Customer # column. */
export const accountingBalancesListTable = {
  ...listInternalAccountingCustomerBalancesTable,
  columns: listInternalAccountingCustomerBalancesTable.columns.filter(
    (column) => column.field !== "customerNumber",
  ),
} as const satisfies TableMeta;

/** Payments grid: applied + unapplied in one column. */
export const accountingPaymentsListTable = {
  ...listInternalAccountingPaymentsTable,
  columns: listInternalAccountingPaymentsTable.columns
    .filter((column) => column.field !== "unappliedCents")
    .map((column) =>
      column.field === "appliedCents"
        ? { ...column, label: "Applied / Unapplied" }
        : column,
    ),
} as const satisfies TableMeta;
