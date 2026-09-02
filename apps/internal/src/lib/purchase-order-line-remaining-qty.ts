type PurchaseOrderLineQty = {
  qty: number;
  receivedQty: number;
};

/** Unreceived units on one PO line. Not persisted — derived at read time. */
export function purchaseOrderLineRemainingQty(
  line: PurchaseOrderLineQty,
): number {
  return line.qty - line.receivedQty;
}
