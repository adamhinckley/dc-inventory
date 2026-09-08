import {
  listInternalProducts,
  listInternalSellWindows,
} from "@dc-inventory/api-client-internal";
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
  inactive: boolean;
  discontinued: boolean;
};

export type SellWindowFilterSnapshot = {
  q?: string;
  category?: string[];
  supplierId?: string[];
  excludeSupplierId?: string[];
};

export type SellWindowStatus = "scheduled" | "open" | "closed";

export type InventoryReopenCommand = {
  name: string;
  filterSnapshot?: SellWindowFilterSnapshot;
  skus: string[];
  windowOpensAt?: string | null;
  windowClosesAt: string;
};

export type InventoryMatchChunk = {
  items: InventoryMatchRow[];
  total: number;
  nextPage: number | null;
};

type ListInternalSellWindowsParams = NonNullable<
  Parameters<typeof listInternalSellWindows>[0]
>;

export type InventoryMatchListFn = (
  params: ListInternalProductsParams,
) => Promise<Awaited<ReturnType<typeof listInternalProducts>>>;

export type SellWindowListFn = (
  params: ListInternalSellWindowsParams,
) => Promise<Awaited<ReturnType<typeof listInternalSellWindows>>>;

export const INVENTORY_MATCH_PAGE_SIZE = 100;
export const INVENTORY_MATCH_PREFETCH_PAGES = 5;
export const SELL_WINDOW_LIST_PAGE_SIZE = 100;
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
  inactive: boolean;
  discontinued: boolean;
}): InventoryMatchRow {
  return {
    sku: row.sku,
    name: row.name,
    supplierName: row.supplierName,
    sellState: row.sellState,
    onHand: row.onHand,
    onOrder: row.onOrder,
    inactive: row.inactive,
    discontinued: row.discontinued,
  };
}

export function filterSnapshotToListParams(
  snapshot: SellWindowFilterSnapshot,
): ListQueryParams {
  const params: ListQueryParams = {};
  if (typeof snapshot.q === "string" && snapshot.q.length > 0) {
    params.q = snapshot.q;
  }
  if (Array.isArray(snapshot.category) && snapshot.category.length > 0) {
    params.category = [...snapshot.category];
  }
  if (Array.isArray(snapshot.supplierId) && snapshot.supplierId.length > 0) {
    params.supplierId = [...snapshot.supplierId];
  }
  if (
    Array.isArray(snapshot.excludeSupplierId) &&
    snapshot.excludeSupplierId.length > 0
  ) {
    params.excludeSupplierId = [...snapshot.excludeSupplierId];
  }
  return params;
}

export function listParamsToFilterSnapshot(
  params: ListQueryParams,
): SellWindowFilterSnapshot {
  const normalized = inventoryListQueryParams(params);
  const snapshot: SellWindowFilterSnapshot = {};
  if (typeof normalized.q === "string" && normalized.q.length > 0) {
    snapshot.q = normalized.q;
  }
  if (Array.isArray(normalized.category) && normalized.category.length > 0) {
    snapshot.category = [...normalized.category];
  }
  if (Array.isArray(normalized.supplierId) && normalized.supplierId.length > 0) {
    snapshot.supplierId = [...normalized.supplierId];
  }
  if (
    Array.isArray(normalized.excludeSupplierId) &&
    normalized.excludeSupplierId.length > 0
  ) {
    snapshot.excludeSupplierId = [...normalized.excludeSupplierId];
  }
  return snapshot;
}

export function isEligibleForSellWindowApply(row: InventoryMatchRow): boolean {
  return !row.inactive && !row.discontinued;
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

export function instantToDateInput(value: string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildInventoryReopenCommand(
  matching: readonly InventoryMatchRow[],
  opensAt: string,
  closesAt: string,
  filterParams: ListQueryParams,
  name: string = "Sell Window",
): InventoryReopenCommand {
  const windowClosesAt = parseOptionalWindowInstant(closesAt);
  if (windowClosesAt === null) {
    throw new Error("window close date is required");
  }
  const trimmedName = name.trim();
  if (trimmedName === "") {
    throw new Error("window name is required");
  }
  const filterSnapshot = listParamsToFilterSnapshot(filterParams);
  const eligibleSkus = matching.filter(isEligibleForSellWindowApply).map((row) => row.sku);
  if (eligibleSkus.length === 0) {
    throw new Error("at least one eligible SKU is required");
  }
  return {
    name: trimmedName,
    filterSnapshot,
    skus: eligibleSkus,
    windowOpensAt: parseOptionalWindowInstant(opensAt),
    windowClosesAt,
  };
}

export function buildSellWindowOpenCommand(input: {
  name: string;
  filterParams: ListQueryParams;
  checkedSkus: readonly string[];
  opensAt: string;
  closesAt: string;
}): InventoryReopenCommand {
  const windowClosesAt = parseOptionalWindowInstant(input.closesAt);
  if (windowClosesAt === null) {
    throw new Error("window close date is required");
  }
  const trimmedName = input.name.trim();
  if (trimmedName === "") {
    throw new Error("window name is required");
  }
  const skus = input.checkedSkus.filter((sku) => sku.trim() !== "");
  if (skus.length === 0) {
    throw new Error("at least one checked SKU is required");
  }
  return {
    name: trimmedName,
    filterSnapshot: listParamsToFilterSnapshot(input.filterParams),
    skus,
    windowOpensAt: parseOptionalWindowInstant(input.opensAt),
    windowClosesAt,
  };
}

export function inventoryReopenQueryKey(
  params: ListQueryParams,
): readonly ["inventory-reopen-matches", "window", ListQueryParams] {
  return ["inventory-reopen-matches", "window", params];
}

export function sellWindowReadOnly(input: {
  status: string;
  manuallyClosedAt: string | null;
}): boolean {
  return input.status === "closed" || input.manuallyClosedAt !== null;
}

function fallbackSellWindowSkuRow(sku: string): InventoryMatchRow {
  return {
    sku,
    name: sku,
    supplierName: null,
    sellState: "—",
    onHand: 0,
    onOrder: 0,
    inactive: false,
    discontinued: false,
  };
}

type SellWindowListPage = Extract<
  Awaited<ReturnType<typeof listInternalSellWindows>>,
  { status: 200 }
>["data"];

export async function listAllInternalSellWindows(
  listWindows: SellWindowListFn = listInternalSellWindows,
): Promise<{ items: SellWindowListPage["items"]; total: number }> {
  let page = 1;
  const first = await listWindows({ page: 1, pageSize: SELL_WINDOW_LIST_PAGE_SIZE });
  if (first.status !== 200) {
    throw new Error("Could not load sell windows.");
  }
  const items = [...first.data.items];
  const total = first.data.total;
  page = 2;
  while ((page - 1) * SELL_WINDOW_LIST_PAGE_SIZE < total) {
    const response = await listWindows({
      page,
      pageSize: SELL_WINDOW_LIST_PAGE_SIZE,
    });
    if (response.status !== 200) {
      throw new Error("Could not load sell windows.");
    }
    items.push(...response.data.items);
    page += 1;
  }
  return { items, total };
}

async function lookupSellWindowSkuRow(
  sku: string,
  listProducts: InventoryMatchListFn,
): Promise<InventoryMatchRow | null> {
  const response = await listProducts({
    q: sku,
    page: 1,
    pageSize: INVENTORY_MATCH_PAGE_SIZE,
  });
  if (response.status !== 200) {
    throw new Error("Could not load inventory matches.");
  }
  const row = response.data.items.find((item) => item.sku === sku);
  return row ? mapMatchRow(row) : null;
}

export async function enrichSellWindowSkuRows(
  skus: readonly string[],
  filterParams: ListQueryParams,
  listProducts: InventoryMatchListFn = listInternalProducts,
): Promise<InventoryMatchRow[]> {
  if (skus.length === 0) {
    return [];
  }
  const pending = new Set(skus);
  const rowBySku = new Map<string, InventoryMatchRow>();
  let page = 1;
  while (pending.size > 0) {
    const chunk = await fetchInventoryMatchPages(filterParams, page, 1, listProducts);
    for (const row of chunk.items) {
      if (pending.has(row.sku)) {
        rowBySku.set(row.sku, row);
        pending.delete(row.sku);
      }
    }
    if (chunk.nextPage === null) {
      break;
    }
    page = chunk.nextPage;
  }
  for (const sku of pending) {
    const row = await lookupSellWindowSkuRow(sku, listProducts);
    if (row !== null) {
      rowBySku.set(sku, row);
    }
  }
  return skus.map((sku) => rowBySku.get(sku) ?? fallbackSellWindowSkuRow(sku));
}

export function sellWindowSkuRowsQueryKey(
  windowId: string,
  skus: readonly string[],
): readonly ["sell-window-sku-rows", string, readonly string[]] {
  return ["sell-window-sku-rows", windowId, skus];
}
