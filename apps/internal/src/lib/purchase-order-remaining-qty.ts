type PurchaseOrderLineQty = {
  qty: number;
  receivedQty: number;
};

/** Sum of unreceived units across PO lines. Not persisted — derived at read time. */
export function purchaseOrderRemainingQty(
  lines: readonly PurchaseOrderLineQty[],
): number {
  return lines.reduce((total, line) => total + (line.qty - line.receivedQty), 0);
}
