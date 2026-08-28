import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Same shape as `supplierProductsListTable` on GET /internal/suppliers/{id}/products (`x-table`).
 * Copied so this app does not import the API package.
 */
export const supplierProductsListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "catalogName", label: "Product" },
    { field: "supplierSku", label: "Vendor item #" },
    { field: "minOrderQty", label: "Min qty" },
    { field: "minOrderAmountCents", label: "Min $ (¢)" },
    { field: "lastPoCostCents", label: "Last cost (¢)" },
    { field: "currency", label: "Currency" },
    { field: "qty.onHand", label: "On hand" },
    { field: "qty.onOrder", label: "On order" },
    { field: "qty.allocated", label: "Allocated" },
    { field: "qty.available", label: "Available" },
  ],
  filters: [],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "catalogName", "qty.onHand", "qty.available"],
  },
} as const satisfies TableMeta;
