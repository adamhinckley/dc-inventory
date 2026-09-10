export type AtpShortage = {
  sku: string;
  name: string;
  requestedQty: number;
  availableQty: number;
};

export type CoverShortage = {
  sku: string;
  name: string;
  requestedQty: number;
  coveredQty: number;
};

export class SalesTransactionError extends Error {
  constructor(
    readonly reason: string,
    readonly shortage?: AtpShortage | CoverShortage,
  ) {
    super(reason);
    this.name = "SalesTransactionError";
  }
}
