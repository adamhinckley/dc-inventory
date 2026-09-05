import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import type { ListQueryParams, TableMeta } from "@dc-inventory/ui-internal";

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
    { field: "supplierName", label: "Factory" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "committed", label: "Committed (pre-sold)" },
    { field: "available", label: "Available (warehouse)" },
    { field: "availableToSell", label: "Available to sell" },
    { field: "sellState", label: "Sell state" },
  ],
  search: listInternalProductsTable.search,
  filters: listInternalProductsTable.filters,
  sort: {
    defaultBy: listInternalProductsTable.sort.defaultBy,
    defaultOrder: listInternalProductsTable.sort.defaultOrder,
    fields: listInternalProductsTable.sort.fields.filter(
      (field): field is (typeof INVENTORY_SORT_FIELDS)[number] =>
        (INVENTORY_SORT_FIELDS as readonly string[]).includes(field),
    ),
  },
} as const satisfies TableMeta;

/** Inventory defaults to every catalog SKU + snapshot qty (zeros included). */
export function inventoryListInitialParams(
  searchParams: Record<string, string | string[] | undefined>,
  parse: (
    meta: typeof inventoryListTable,
    params: Record<string, string | string[] | undefined>,
  ) => ListQueryParams,
): ListQueryParams {
  return parse(inventoryListTable, searchParams);
}

/** Passes list params through; hide-empty is opt-in via `hideZeroInventory: true`. */
export function inventoryListQueryParams(
  params?: ListQueryParams,
): ListQueryParams {
  return params ?? {};
}
