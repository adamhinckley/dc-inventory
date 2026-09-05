import { listInternalUncoveredSkusTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

/** Staff uncovered worksheet: API columns plus client suggested draft PO qty. */
export const uncoveredListTable = {
  rowId: listInternalUncoveredSkusTable.rowId,
  columns: [
    ...listInternalUncoveredSkusTable.columns,
    { field: "suggestedQty", label: "Suggested qty" },
  ],
} as const satisfies TableMeta;
