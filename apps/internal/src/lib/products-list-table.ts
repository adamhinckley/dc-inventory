import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Same shape as `productsListTable` on GET /internal/products (`x-table`).
 * Copied so this app does not import the API package. Do not add filters here.
 */
export const productsListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "memberPrice", label: "Member price" },
    { field: "currency", label: "Currency" },
    { field: "inactive", label: "Inactive" },
    { field: "discontinued", label: "Discontinued" },
    { field: "webWholesale", label: "Web wholesale" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "available", label: "Available" },
    { field: "createdAt", label: "Created" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [{ param: "inactive", control: "boolean" }],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "name", "onHand", "available", "createdAt"],
  },
} as const satisfies TableMeta;
