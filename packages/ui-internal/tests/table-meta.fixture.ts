import type { TableMeta } from "../src/data-table/table-meta";

/** Mirrors generated `listInternalProducts` x-table metadata for unit tests. */
export const productsListTableFixture = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "listPrice", label: "List price" },
    { field: "lastPoCostCents", label: "Unit cost" },
    { field: "inactive", label: "Inactive" },
    { field: "discontinued", label: "Discontinued" },
    { field: "webWholesale", label: "Web wholesale" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [
    { param: "inactive", control: "boolean" },
    { param: "hideZeroInventory", control: "boolean" },
  ],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "name", "onHand", "available", "caseQty", "createdAt"],
  },
} as const satisfies TableMeta;
