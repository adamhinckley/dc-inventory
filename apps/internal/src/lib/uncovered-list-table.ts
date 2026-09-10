import { listInternalUncoveredSkusTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

const PRE_ORDER_COLUMN_LABELS: Partial<
  Record<(typeof listInternalUncoveredSkusTable.columns)[number]["field"], string>
> = {
  uncovered: "To Order",
  committed: "Pre-sold",
};

/** Staff pre-order worksheet: API columns plus client suggested draft PO qty. */
export const uncoveredListTable = {
  rowId: listInternalUncoveredSkusTable.rowId,
  columns: [
    ...listInternalUncoveredSkusTable.columns.map((column) => ({
      ...column,
      label: PRE_ORDER_COLUMN_LABELS[column.field] ?? column.label,
    })),
    { field: "suggestedQty", label: "Suggested qty" },
  ],
} as const satisfies TableMeta;
