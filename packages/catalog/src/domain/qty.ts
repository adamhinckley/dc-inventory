export type ProductQty = {
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
};

export const ZERO_QTY: ProductQty = {
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
};
