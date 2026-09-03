import type { PurchaseOrderLineDraft } from "./purchase-order-types";

export type PurchaseOrderLineWrite = {
  sku: string;
  name: string;
  qty: number;
};

export type PurchaseOrderLineQty = {
  qty: number;
  receivedQty: number;
};

export type ReceiveLineFilterRow = PurchaseOrderLineQty & {
  sku: string;
  name: string;
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
  return (
    JSON.stringify(purchaseOrderWriteLines(left)) ===
    JSON.stringify(purchaseOrderWriteLines(right))
  );
}

export function removePurchaseOrderLinesByRowKeys(
  lines: readonly PurchaseOrderLineDraft[],
  keys: ReadonlySet<string>,
): PurchaseOrderLineDraft[] | null {
  const next = lines.filter(
    (line, index) => !keys.has(purchaseOrderLineRowKey(line, index)),
  );
  if (next.length === 0) {
    return null;
  }
  return next;
}

export function purchaseOrderLinesSavedForConfirm(
  lines: readonly PurchaseOrderLineDraft[],
  lastSaved: readonly PurchaseOrderLineDraft[],
  lastPersistSucceeded: boolean,
): boolean {
  return lastPersistSucceeded && purchaseOrderLineWritesEqual(lines, lastSaved);
}

/**
 * Ceil need to the next master pack (`cs_qty`). Need 584 with 100/case → 600.
 * No need yet keeps today's picker default of 1.
 */
export function suggestedDraftPoQty(
  need: number,
  caseQty: number | null,
): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}

export function casesForDraftPoQty(
  qty: number,
  caseQty: number | null,
): number | null {
  if (caseQty === null || caseQty <= 0) {
    return null;
  }
  return qty / caseQty;
}

/**
 * A picker click becomes a draft line. Qty covers uncovered demand,
 * rounded up to a master pack when case qty exists.
 */
export function draftLineFromVendorProduct(product: {
  sku: string;
  catalogName: string;
  caseQty?: number | null;
  qty?: { uncovered: number };
}): PurchaseOrderLineDraft {
  return {
    id: crypto.randomUUID(),
    sku: product.sku,
    name: product.catalogName,
    qty: suggestedDraftPoQty(product.qty?.uncovered ?? 0, product.caseQty ?? null),
  };
}

/** Unreceived units on one PO line. Not persisted — derived at read time. */
export function purchaseOrderLineRemainingQty(
  line: PurchaseOrderLineQty,
): number {
  return line.qty - line.receivedQty;
}

/** Sum of unreceived units across PO lines. Not persisted — derived at read time. */
export function purchaseOrderRemainingQty(
  lines: readonly PurchaseOrderLineQty[],
): number {
  return lines.reduce(
    (total, line) => total + purchaseOrderLineRemainingQty(line),
    0,
  );
}

export function filterReceiveLines<T extends ReceiveLineFilterRow & { remaining: number }>(
  lines: readonly T[],
  find: string,
  remainingOnly: boolean,
): T[] {
  const needle = find.trim().toLowerCase();
  return lines.filter((line) => {
    if (remainingOnly && line.remaining <= 0) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    return (
      line.sku.toLowerCase().includes(needle) ||
      line.name.toLowerCase().includes(needle)
    );
  });
}

export function purchaseOrderWasShortReceived(
  lines: readonly PurchaseOrderLineQty[],
): boolean {
  return lines.some((line) => line.receivedQty < line.qty);
}

export function purchaseOrderHasReceivedQty(
  lines: readonly PurchaseOrderLineQty[],
): boolean {
  return lines.some((line) => line.receivedQty > 0);
}

export function receiveLinesPayload(
  lines: readonly { id: string; remaining: number }[],
  receiveQtyByLineId: Readonly<Record<string, number>>,
): { lineId: string; quantity: number }[] {
  return lines
    .map((line) => ({
      lineId: line.id,
      quantity: receiveQtyByLineId[line.id] ?? 0,
    }))
    .filter((line) => line.quantity > 0);
}

export function receivingCanReceive(
  status: "draft" | "confirmed" | "received" | "cancelled",
  totalRemaining: number,
): boolean {
  return status === "confirmed" && totalRemaining > 0;
}

export function receivingCanCancelRemaining(
  status: "draft" | "confirmed" | "received" | "cancelled",
  totalRemaining: number,
  lines: readonly PurchaseOrderLineQty[],
): boolean {
  return (
    status === "confirmed" &&
    totalRemaining > 0 &&
    purchaseOrderHasReceivedQty(lines)
  );
}

export function receivingShowShortPanel(
  status: "draft" | "confirmed" | "received" | "cancelled",
  lines: readonly PurchaseOrderLineQty[],
): boolean {
  return status === "received" && purchaseOrderWasShortReceived(lines);
}
