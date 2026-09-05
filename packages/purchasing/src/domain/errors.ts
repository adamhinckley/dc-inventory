export class PurchasingTransactionError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "PurchasingTransactionError";
  }
}

export class DraftPurchaseOrdersAbortError extends Error {
  constructor(
    readonly reason: "invalid",
    readonly unmappedSkus: readonly string[],
  ) {
    super(reason);
    this.name = "DraftPurchaseOrdersAbortError";
  }
}
