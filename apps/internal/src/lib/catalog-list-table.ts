import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

const CATALOG_SORT_FIELDS = ["sku", "name"] as const;

/**
 * Staff catalog merchandising list. Inventory qty lives on Inventory;
 * cost comes from supplier × SKU (`po_cost` on Product Browser import).
 */
export const catalogListTable = {
  rowId: listInternalProductsTable.rowId,
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "listPrice", label: "List price" },
    { field: "lastPoCostCents", label: "Unit cost" },
    { field: "inactive", label: "Inactive" },
    { field: "discontinued", label: "Discontinued" },
    { field: "webWholesale", label: "Web wholesale" },
  ],
  search: listInternalProductsTable.search,
  filters: listInternalProductsTable.filters?.filter(
    (filter) => filter.param !== "hideZeroInventory",
  ),
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: [...CATALOG_SORT_FIELDS],
  },
} as const satisfies TableMeta;
