export type SupplierProductQty = {
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  committed: number;
  toOrder: number;
};

export const ZERO_SUPPLIER_PRODUCT_QTY: SupplierProductQty = {
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
  committed: 0,
  toOrder: 0,
};
