import { listInternalPurchaseOrdersTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Confirmed inbound PO list for Receiving. Same Orval hook as purchasing lists,
 * but only merchandising columns staff need at the dock.
 */
export const receivingListTable = {
  rowId: listInternalPurchaseOrdersTable.rowId,
  columns: [
    { field: "documentNumber", label: "PO #" },
    { field: "supplierName", label: "Supplier" },
    { field: "shipDate", label: "Ship date" },
    { field: "remaining", label: "Remaining" },
  ],
  search: listInternalPurchaseOrdersTable.search,
  sort: {
    defaultBy: listInternalPurchaseOrdersTable.sort.defaultBy,
    defaultOrder: listInternalPurchaseOrdersTable.sort.defaultOrder,
    fields: ["documentNumber"],
  },
} as const satisfies TableMeta;
