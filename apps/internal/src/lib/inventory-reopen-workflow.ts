import { listInternalProducts } from "@dc-inventory/api-client-internal";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { inventoryListQueryParams } from "./inventory-list-table";

type ListInternalProductsParams = NonNullable<Parameters<typeof listInternalProducts>[0]>;

export type InventoryMatchRow = {
  sku: string;
  name: string;
  sellState: string;
  onHand: number;
  onOrder: number;
};

export type InventoryReopenCommand = {
  skus: string[];
  windowOpensAt: string | null;
  windowClosesAt: string | null;
};

const MATCH_PAGE_SIZE = 100;

export async function fetchAllInventoryMatches(
  params: ListQueryParams,
): Promise<InventoryMatchRow[]> {
  const base = inventoryListQueryParams(params) as ListInternalProductsParams;
  let page = 1;
  const items: InventoryMatchRow[] = [];
  while (true) {
    const response = await listInternalProducts({ ...base, page, pageSize: MATCH_PAGE_SIZE });
    if (response.status !== 200) {
      throw new Error("Could not load inventory matches.");
    }
    const pageItems = response.data.items.map((row) => ({
      sku: row.sku,
      name: row.name,
      sellState: row.sellState,
      onHand: row.onHand,
      onOrder: row.onOrder,
    }));
    items.push(...pageItems);
    const offset = (page - 1) * MATCH_PAGE_SIZE + pageItems.length;
    if (offset >= response.data.total || pageItems.length < MATCH_PAGE_SIZE) {
      break;
    }
    page += 1;
  }
  return items;
}

export function parseOptionalWindowInstant(date: string): string | null {
  const trimmed = date.trim();
  if (trimmed === "") {
    return null;
  }
  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts.map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day).toISOString();
}

export function buildInventoryReopenCommand(
  matching: readonly InventoryMatchRow[],
  opensAt: string,
  closesAt: string,
): InventoryReopenCommand {
  return {
    skus: matching.map((row) => row.sku),
    windowOpensAt: parseOptionalWindowInstant(opensAt),
    windowClosesAt: parseOptionalWindowInstant(closesAt),
  };
}

export function inventoryReopenQueryKey(params: ListQueryParams): readonly [string, ListQueryParams] {
  return ["inventory-reopen-matches", params];
}
