import { listInternalPreOrderSkusTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

const PRE_ORDER_COLUMN_LABELS: Partial<
  Record<(typeof listInternalPreOrderSkusTable.columns)[number]["field"], string>
> = {
  toOrder: "To Order",
  committed: "Pre-sold",
};

/** Staff pre-order worksheet: API columns plus client suggested draft PO qty. */
export const preOrderListTable = {
  rowId: listInternalPreOrderSkusTable.rowId,
  columns: [
    ...listInternalPreOrderSkusTable.columns.map((column) => ({
      ...column,
      label: PRE_ORDER_COLUMN_LABELS[column.field] ?? column.label,
    })),
    { field: "suggestedQty", label: "Suggested qty" },
  ],
} as const satisfies TableMeta;
