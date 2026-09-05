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
};

export type StaffCatalogQtyProjection = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  committed: number;
  sellState: SellState;
  availableToSell: number | null;
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
  });
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

/** Wholesale shop filter: open SKUs by warehouse leftover; locked SKUs by availableToSell. */
export function isShopSellable(qty: ProductQty): boolean {
  if (qty.sellState === "locked") {
    return qty.availableToSell !== null && qty.availableToSell > 0;
  }
  return qty.available > 0;
}

/** Qty to show on wholesale product cards (matches isShopSellable). */
export function shopDisplayAvailableQty(
  qty: Pick<ProductQty, "available" | "availableToSell" | "sellState">,
): number | null {
  if (qty.sellState === "locked") {
    return qty.availableToSell !== null && qty.availableToSell > 0 ? qty.availableToSell : null;
  }
  return qty.available > 0 ? qty.available : null;
}

/** Wholesale card availability label (matches isShopSellable / shopDisplayAvailableQty). */
export function shopAvailabilityLabel(
  qty: Pick<ProductQty, "available" | "availableToSell" | "sellState">,
): { inStock: boolean; label: string } {
  const displayQty = shopDisplayAvailableQty(qty);
  if (displayQty === null) {
    return { inStock: false, label: "Unavailable" };
  }
  return { inStock: true, label: `${displayQty.toLocaleString()} available` };
}
