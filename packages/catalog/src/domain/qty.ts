import {
  hasActiveSellWindowMembership,
  type SellWindowTiming,
} from "@dc-inventory/inventory";

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
  activeSellWindows?: readonly SellWindowTiming[];
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

function resolveActiveSellWindowMembership(
  qty: Pick<ProductQty, "hasActiveSellWindowMembership">,
  options?: WholesaleVisibilityOptions,
): boolean {
  if (qty.hasActiveSellWindowMembership === true) {
    return true;
  }
  if (options?.activeSellWindows !== undefined && options.activeSellWindows.length > 0) {
    return hasActiveSellWindowMembership(options.activeSellWindows, options.now);
  }
  return false;
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
  return !resolveActiveSellWindowMembership(qty, options);
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

/** Wholesale shop filter: every open SKU; locked SKUs by availableToSell. */
export function isShopSellable(qty: ProductQty): boolean {
  if (qty.sellState === "locked") {
    return qty.availableToSell !== null && qty.availableToSell > 0;
  }
  return true;
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
