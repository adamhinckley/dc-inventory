import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

const INVENTORY_SORT_FIELDS = [
  "sku",
  "name",
  "onHand",
  "onOrder",
  "allocated",
  "committed",
  "available",
  "availableToSell",
  "sellState",
] as const;

/**
 * Display subset of `listInternalProducts`. Same search/sort params the
 * products list already accepts — merchandising columns stay on Catalog.
 */
export const inventoryListTable = {
  rowId: listInternalProductsTable.rowId,
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "committed", label: "Committed (pre-sold)" },
    { field: "available", label: "Available (warehouse)" },
    { field: "availableToSell", label: "Available to sell" },
    { field: "sellState", label: "Sell state" },
  ],
  search: listInternalProductsTable.search,
  filters: [{ param: "hideZeroInventory", control: "boolean" }],
  sort: {
    defaultBy: listInternalProductsTable.sort.defaultBy,
    defaultOrder: listInternalProductsTable.sort.defaultOrder,
    fields: listInternalProductsTable.sort.fields.filter(
      (field): field is (typeof INVENTORY_SORT_FIELDS)[number] =>
        (INVENTORY_SORT_FIELDS as readonly string[]).includes(field),
    ),
  },
} as const satisfies TableMeta;

/** Inventory defaults to hiding catalog SKUs with an all-zero snapshot. */
export function inventoryListInitialParams(
  searchParams: Record<string, string | string[] | undefined>,
  parse: (
    meta: typeof inventoryListTable,
    params: Record<string, string | string[] | undefined>,
  ) => Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  const parsed = parse(inventoryListTable, searchParams);
  return {
    ...parsed,
    hideZeroInventory: parsed.hideZeroInventory ?? true,
  };
}
