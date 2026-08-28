import type { PurchaseOrderLineDraft } from "./purchase-order-types";

export type PurchaseOrderLineWrite = {
  sku: string;
  name: string;
  qty: number;
};

export function purchaseOrderLineRowKey(
  line: PurchaseOrderLineDraft,
  index: number,
): string {
  return line.id ?? `${line.sku}:${String(index)}`;
}

export function coalescePurchaseOrderLines(
  lines: readonly PurchaseOrderLineDraft[],
): PurchaseOrderLineDraft[] {
  const bySku = new Map<string, PurchaseOrderLineDraft>();
  for (const line of lines) {
    const existing = bySku.get(line.sku);
    if (existing === undefined) {
      bySku.set(line.sku, { ...line });
      continue;
    }
    bySku.set(line.sku, {
      ...existing,
      qty: existing.qty + line.qty,
    });
  }
  return [...bySku.values()];
}

export function appendPurchaseOrderLine(
  lines: readonly PurchaseOrderLineDraft[],
  line: PurchaseOrderLineDraft,
): PurchaseOrderLineDraft[] {
  return coalescePurchaseOrderLines([...lines, line]);
}

export function purchaseOrderWriteLines(
  lines: readonly PurchaseOrderLineDraft[],
): PurchaseOrderLineWrite[] {
  return coalescePurchaseOrderLines(lines).map((line) => ({
    sku: line.sku,
    name: line.name,
    qty: line.qty,
  }));
}

export function purchaseOrderLineWritesEqual(
  left: readonly PurchaseOrderLineDraft[],
  right: readonly PurchaseOrderLineDraft[],
): boolean {
  return JSON.stringify(purchaseOrderWriteLines(left)) === JSON.stringify(purchaseOrderWriteLines(right));
}

export function purchaseOrderLinesSavedForConfirm(
  lines: readonly PurchaseOrderLineDraft[],
  lastSaved: readonly PurchaseOrderLineDraft[],
  lastPersistSucceeded: boolean,
): boolean {
  return lastPersistSucceeded && purchaseOrderLineWritesEqual(lines, lastSaved);
}
