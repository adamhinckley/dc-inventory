import type { FakeSku } from "./fake-catalog";
import type { ActiveFilter, FilterValue } from "./use-local-filters";

function bool(value: FilterValue): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function str(value: FilterValue): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function valueOf(active: ActiveFilter[], field: string): FilterValue {
  return active.find((row) => row.field === field)?.value ?? null;
}

export function applyReopenFilters(
  rows: readonly FakeSku[],
  search: string,
  active: ActiveFilter[],
): FakeSku[] {
  const q = search.trim().toLowerCase();
  const factory = str(valueOf(active, "factory"));
  const category = str(valueOf(active, "category"));
  const sellState = str(valueOf(active, "sellState"));
  const activeOnly = bool(valueOf(active, "active"));
  const discontinued = bool(valueOf(active, "discontinued"));
  const webWholesale = bool(valueOf(active, "webWholesale"));
  const excludeNeverOpen = bool(valueOf(active, "excludeNeverOpen"));
  const hasFloorStock = bool(valueOf(active, "hasFloorStock"));
  const hasOnOrder = bool(valueOf(active, "hasOnOrder"));
  const sellWindow = str(valueOf(active, "sellWindow"));
  const newThisPresell = bool(valueOf(active, "newThisPresell"));

  return rows.filter((row) => {
    if (q.length > 0 && !`${row.sku} ${row.name}`.toLowerCase().includes(q)) {
      return false;
    }
    if (factory && row.factory !== factory) {
      return false;
    }
    if (category && row.category !== category) {
      return false;
    }
    if (sellState && row.sellState !== sellState) {
      return false;
    }
    if (activeOnly === true && !row.active) {
      return false;
    }
    if (activeOnly === false && row.active) {
      return false;
    }
    if (discontinued === true && !row.discontinued) {
      return false;
    }
    if (discontinued === false && row.discontinued) {
      return false;
    }
    if (webWholesale === true && !row.webWholesale) {
      return false;
    }
    if (webWholesale === false && row.webWholesale) {
      return false;
    }
    if (excludeNeverOpen === true && row.neverOpen) {
      return false;
    }
    if (excludeNeverOpen === false && !row.neverOpen) {
      return false;
    }
    if (hasFloorStock === true && row.onHand <= 0) {
      return false;
    }
    if (hasFloorStock === false && row.onHand > 0) {
      return false;
    }
    if (hasOnOrder === true && row.onOrder <= 0) {
      return false;
    }
    if (hasOnOrder === false && row.onOrder > 0) {
      return false;
    }
    const hasWindow = row.windowOpensAt !== null || row.windowClosesAt !== null;
    if (sellWindow === "none" && hasWindow) {
      return false;
    }
    if (sellWindow === "set" && !hasWindow) {
      return false;
    }
    if (newThisPresell === true && !row.isNewThisPresell) {
      return false;
    }
    if (newThisPresell === false && row.isNewThisPresell) {
      return false;
    }
    return true;
  });
}
