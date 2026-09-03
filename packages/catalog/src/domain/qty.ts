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
