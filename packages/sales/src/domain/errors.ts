export type SalesShortage = {
  sku: string;
  name: string;
  requestedQty: number;
  availableQty: number;
};

export class SalesTransactionError extends Error {
  constructor(
    readonly reason: string,
    readonly shortage?: SalesShortage,
  ) {
    super(reason);
    this.name = "SalesTransactionError";
  }
}
