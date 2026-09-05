import { listInternalProducts } from "@dc-inventory/api-client-internal";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { inventoryListQueryParams } from "./inventory-list-table";

type ListInternalProductsParams = NonNullable<Parameters<typeof listInternalProducts>[0]>;

export type InventoryMatchRow = {
  sku: string;
  name: string;
  supplierName: string | null;
  sellState: string;
  onHand: number;
  onOrder: number;
};

export type InventoryReopenCommand = {
  skus: string[];
  windowOpensAt: string | null;
  windowClosesAt: string | null;
};

export type InventoryMatchChunk = {
  items: InventoryMatchRow[];
  total: number;
  nextPage: number | null;
};

export type InventoryMatchListFn = (
  params: ListInternalProductsParams,
) => Promise<Awaited<ReturnType<typeof listInternalProducts>>>;

export const INVENTORY_MATCH_PAGE_SIZE = 100;
export const INVENTORY_MATCH_PREFETCH_PAGES = 5;
/** 1-based page inside the current window that should trigger the next fetch. */
export const INVENTORY_MATCH_PREFETCH_AT_PAGE = 3;

function listParams(params: ListQueryParams): ListInternalProductsParams {
  return inventoryListQueryParams(params) as ListInternalProductsParams;
}

function mapMatchRow(row: {
  sku: string;
  name: string;
  supplierName: string | null;
  sellState: string;
  onHand: number;
  onOrder: number;
}): InventoryMatchRow {
  return {
    sku: row.sku,
    name: row.name,
    supplierName: row.supplierName,
    sellState: row.sellState,
    onHand: row.onHand,
    onOrder: row.onOrder,
  };
}

export function shouldPrefetchInventoryMatches(input: {
  loadedCount: number;
  total: number;
  visibleIndex: number;
  pageSize?: number;
  prefetchAtPage?: number;
}): boolean {
  const pageSize = input.pageSize ?? INVENTORY_MATCH_PAGE_SIZE;
  const prefetchAtPage = input.prefetchAtPage ?? INVENTORY_MATCH_PREFETCH_AT_PAGE;
  if (input.loadedCount === 0 || input.loadedCount >= input.total) {
    return false;
  }
  const loadedPages = Math.ceil(input.loadedCount / pageSize);
  const visiblePage = Math.floor(input.visibleIndex / pageSize) + 1;
  return visiblePage >= loadedPages - (INVENTORY_MATCH_PREFETCH_PAGES - prefetchAtPage);
}

export async function fetchInventoryMatchPages(
  params: ListQueryParams,
  startPage: number,
  pageCount: number = INVENTORY_MATCH_PREFETCH_PAGES,
  listProducts: InventoryMatchListFn = listInternalProducts,
): Promise<InventoryMatchChunk> {
  const base = listParams(params);
  const first = await listProducts({
    ...base,
    page: startPage,
    pageSize: INVENTORY_MATCH_PAGE_SIZE,
  });
  if (first.status !== 200) {
    throw new Error("Could not load inventory matches.");
  }
  const items = first.data.items.map(mapMatchRow);
  const total = first.data.total;
  let loadedThrough = (startPage - 1) * INVENTORY_MATCH_PAGE_SIZE + items.length;
  if (loadedThrough >= total || pageCount <= 1) {
    return {
      items,
      total,
      nextPage: loadedThrough >= total ? null : startPage + 1,
    };
  }
  const extraPages = Math.min(
    pageCount - 1,
    Math.ceil((total - loadedThrough) / INVENTORY_MATCH_PAGE_SIZE),
  );
  const rest = await Promise.all(
    Array.from({ length: extraPages }, (_, index) =>
      listProducts({
        ...base,
        page: startPage + 1 + index,
        pageSize: INVENTORY_MATCH_PAGE_SIZE,
      }),
    ),
  );
  for (const response of rest) {
    if (response.status !== 200) {
      throw new Error("Could not load inventory matches.");
    }
    items.push(...response.data.items.map(mapMatchRow));
  }
  loadedThrough = (startPage - 1) * INVENTORY_MATCH_PAGE_SIZE + items.length;
  return {
    items,
    total,
    nextPage: loadedThrough >= total ? null : startPage + 1 + extraPages,
  };
}

export async function fetchRemainingInventoryMatches(
  params: ListQueryParams,
  startPage: number,
  listProducts: InventoryMatchListFn = listInternalProducts,
): Promise<InventoryMatchRow[]> {
  const items: InventoryMatchRow[] = [];
  let page = startPage;
  while (page !== null) {
    const chunk = await fetchInventoryMatchPages(
      params,
      page,
      INVENTORY_MATCH_PREFETCH_PAGES,
      listProducts,
    );
    items.push(...chunk.items);
    if (chunk.nextPage === null) {
      break;
    }
    page = chunk.nextPage;
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

export function inventoryReopenQueryKey(
  params: ListQueryParams,
): readonly ["inventory-reopen-matches", "window", ListQueryParams] {
  return ["inventory-reopen-matches", "window", params];
}
