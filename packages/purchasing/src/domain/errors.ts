export class PurchasingTransactionError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "PurchasingTransactionError";
  }
}
