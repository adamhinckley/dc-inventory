export type SupplierProductQty = {
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
};

export const ZERO_SUPPLIER_PRODUCT_QTY: SupplierProductQty = {
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
};
