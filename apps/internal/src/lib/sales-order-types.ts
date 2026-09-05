export type SalesOrderLineDraft = {
  rowKey: string;
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
};

export type SalesOrderLineSnapshot = {
  rowKey: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
};
