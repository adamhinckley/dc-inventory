import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import type { TableMeta } from "@dc-inventory/ui-internal";

/**
 * Staff catalog merchandising list. Snapshot-only `hideZeroInventory` stays on
 * Inventory — not catalog filter chrome.
 */
export const catalogListTable = {
  ...listInternalProductsTable,
  filters: listInternalProductsTable.filters?.filter(
    (filter) => filter.param !== "hideZeroInventory",
  ),
} as const satisfies TableMeta;
