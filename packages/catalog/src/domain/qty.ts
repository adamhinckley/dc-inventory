export type SellState = "open" | "locked";

export type ProductQty = {
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  committed: number;
  sellState: SellState;
  /** `null` means no numeric cap while effectively open. */
  availableToSell: number | null;
  stickyLocked?: boolean;
  windowOpensAt?: Date | null;
  windowClosesAt?: Date | null;
  hasActiveSellWindowMembership?: boolean;
};

export type StaffCatalogQtyProjection = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  committed: number;
  sellState: SellState;
  availableToSell: number | null;
  stickyLocked?: boolean;
  windowOpensAt?: Date | null;
  windowClosesAt?: Date | null;
  hasActiveSellWindowMembership?: boolean;
}>;

export type WholesaleVisibilityOptions = Readonly<{
  now: Date;
}>;

/** Anti-corruption snapshot from Inventory's staff/shop qty projection. */
export function productQtyFromStaffCatalogProjection(
  projection: StaffCatalogQtyProjection,
): ProductQty {
  return Object.freeze({
    onHand: projection.onHand,
    onOrder: projection.onOrder,
    allocated: projection.allocated,
    available: projection.available,
    committed: projection.committed,
    sellState: projection.sellState,
    availableToSell: projection.availableToSell,
    stickyLocked: projection.stickyLocked,
    windowOpensAt: projection.windowOpensAt,
    windowClosesAt: projection.windowClosesAt,
    hasActiveSellWindowMembership: projection.hasActiveSellWindowMembership,
  });
}

/** Wholesale shop hides SKUs scheduled before windowOpensAt; post-close locked SKUs stay visible. */
export function isWholesaleHiddenBeforeOpen(
  qty: ProductQty,
  options: WholesaleVisibilityOptions,
): boolean {
  if (qty.stickyLocked === true) {
    return false;
  }
  const windowOpensAt = qty.windowOpensAt ?? null;
  if (windowOpensAt === null || options.now >= windowOpensAt) {
    return false;
  }
  return qty.hasActiveSellWindowMembership !== true;
}

export const ZERO_QTY: ProductQty = {
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
  committed: 0,
  sellState: "open",
  availableToSell: null,
};

/** Locked SKU with inbound ATP ready to ship (warehouse-ready). */
export function isWarehouseReady(qty: ProductQty): boolean {
  return (
    qty.sellState === "locked" &&
    qty.availableToSell !== null &&
    qty.availableToSell > 0
  );
}

/** Open SKU (pre-order / no numeric cap). Shop visibility is separate. */
export function isOpenPresale(qty: ProductQty): boolean {
  return qty.sellState === "open";
}

export type WholesaleAvailabilityFilters = Readonly<{
  inStockOnly: boolean;
  preOrderOnly: boolean;
}>;

/** Maps legacy availableOnly or explicit inStockOnly × preOrderOnly toggles. */
export function resolveWholesaleAvailabilityFilters(input: {
  inStockOnly?: boolean;
  preOrderOnly?: boolean;
  availableOnly?: boolean;
}): WholesaleAvailabilityFilters {
  if (input.inStockOnly !== undefined || input.preOrderOnly !== undefined) {
    return Object.freeze({
      inStockOnly: input.inStockOnly ?? true,
      preOrderOnly: input.preOrderOnly ?? true,
    });
  }
  const legacy = input.availableOnly ?? true;
  return Object.freeze({ inStockOnly: legacy, preOrderOnly: legacy });
}

/**
 * Returns resolved wholesale availability toggles when the list query explicitly
 * requests filtering; null preserves staff/CSV behavior (show locked sold-out).
 */
export function resolveCatalogListAvailabilityFilter(input: {
  inStockOnly?: boolean;
  preOrderOnly?: boolean;
  availableOnly?: boolean;
}): WholesaleAvailabilityFilters | null {
  if (
    input.inStockOnly === undefined &&
    input.preOrderOnly === undefined &&
    input.availableOnly === undefined
  ) {
    return null;
  }
  return resolveWholesaleAvailabilityFilters(input);
}

/** Wholesale list availability matrix (inStockOnly × preOrderOnly). */
export function matchesWholesaleAvailabilityFilter(
  qty: ProductQty,
  filters: WholesaleAvailabilityFilters,
): boolean {
  if (!filters.inStockOnly && !filters.preOrderOnly) {
    return true;
  }
  const warehouseReady = isWarehouseReady(qty);
  const openPresale = isOpenPresale(qty);
  if (filters.inStockOnly && filters.preOrderOnly) {
    return warehouseReady || openPresale;
  }
  if (filters.inStockOnly) {
    return warehouseReady;
  }
  return openPresale;
}

/** Wholesale shop filter: every open SKU; locked SKUs by availableToSell. */
export function isShopSellable(qty: ProductQty): boolean {
  return matchesWholesaleAvailabilityFilter(qty, {
    inStockOnly: true,
    preOrderOnly: true,
  });
}

/** Qty to show on wholesale product cards (locked ATP only; open SKUs show no number). */
export function shopDisplayAvailableQty(
  qty: Pick<ProductQty, "available" | "availableToSell" | "sellState">,
): number | null {
  if (qty.sellState === "locked") {
    return qty.availableToSell !== null && qty.availableToSell > 0 ? qty.availableToSell : null;
  }
  return null;
}

/** Wholesale card availability label (matches isShopSellable / shopDisplayAvailableQty). */
export function shopAvailabilityLabel(
  qty: Pick<ProductQty, "available" | "availableToSell" | "sellState">,
): { inStock: boolean; label: string } {
  if (qty.sellState === "open") {
    return { inStock: true, label: "Available to order" };
  }
  const displayQty = shopDisplayAvailableQty(qty);
  if (displayQty === null) {
    return { inStock: false, label: "Unavailable" };
  }
  return { inStock: true, label: `${displayQty.toLocaleString()} available` };
}
