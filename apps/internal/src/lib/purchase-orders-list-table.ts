import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Same shape as `purchaseOrdersListTable` on GET /internal/purchase-orders (`x-table`).
 * Copied so this app does not import the API package. Do not add filters here.
 */
export const purchaseOrdersListTable = {
  rowId: "id",
  columns: [
    { field: "documentNumber", label: "PO #" },
    { field: "status", label: "Status" },
    { field: "supplierName", label: "Supplier" },
  ],
  filters: [],
  sort: {
    defaultBy: "documentNumber",
    defaultOrder: "asc",
    fields: ["documentNumber", "status"],
  },
} as const satisfies TableMeta;
