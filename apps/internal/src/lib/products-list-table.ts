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
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "available", label: "Available" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [{ param: "status", control: "select" }],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "name", "available", "createdAt"],
  },
} as const satisfies TableMeta;

export const productStatusFilterOptions = [
  { value: "active", label: "active" },
  { value: "inactive", label: "inactive" },
] as const;
