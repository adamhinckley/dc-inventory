export class PurchasingTransactionError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "PurchasingTransactionError";
  }
}

export class SupplierPoPrefixMissingError extends Error {
  constructor() {
    super("supplier_po_prefix_missing");
    this.name = "SupplierPoPrefixMissingError";
  }
}

export class DraftPurchaseOrdersAbortError extends Error {
  constructor(
    readonly reason: "invalid" | "supplier_po_prefix_missing",
    readonly unmappedSkus: readonly string[],
  ) {
    super(reason);
    this.name = "DraftPurchaseOrdersAbortError";
  }
}
