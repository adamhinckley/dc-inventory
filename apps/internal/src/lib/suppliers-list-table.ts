import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Same shape as `suppliersListTable` on GET /internal/suppliers (`x-table`).
 * Copied so this app does not import the API package.
 */
export const suppliersListTable = {
  rowId: "id",
  columns: [
    { field: "vendorNumber", label: "Vendor #" },
    { field: "name", label: "Name" },
  ],
  search: {
    param: "q",
    fields: ["vendorNumber", "name"],
    placeholder: "Search vendor # or name",
  },
  filters: [],
  sort: {
    defaultBy: "vendorNumber",
    defaultOrder: "asc",
    fields: [],
  },
} as const satisfies TableMeta;
