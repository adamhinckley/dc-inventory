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

export const ZERO_QTY: ProductQty = {
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
  committed: 0,
  sellState: "open",
  availableToSell: null,
};
