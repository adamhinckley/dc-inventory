import type { SalesOrderLineDraft } from "./sales-order-types";

export function salesOrderLineRowKey(line: { sku: string; id?: string }): string {
  return line.id ?? line.sku;
}

export function salesOrderWriteLines(
  lines: readonly SalesOrderLineDraft[],
): Array<{ productId: string; qty: number }> {
  return lines.map((line) => ({
    productId: line.productId,
    qty: line.qty,
  }));
}

export function salesOrderLineWritesEqual(
  left: readonly SalesOrderLineDraft[],
  right: readonly SalesOrderLineDraft[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const leftBySku = new Map(left.map((line) => [line.sku, line.qty]));
  for (const line of right) {
    if (leftBySku.get(line.sku) !== line.qty) {
      return false;
    }
  }
  return true;
}

export function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

export function salesOrderSubtotalCents(
  lines: ReadonlyArray<{ qty: number; unitPriceCents: number }>,
): number {
  return lines.reduce((sum, line) => sum + lineSubtotalCents(line.qty, line.unitPriceCents), 0);
}

export function salesOrderLinesResolved(lines: readonly SalesOrderLineDraft[]): boolean {
  return lines.every((line) => line.productId.length > 0);
}

export function salesOrderCatalogLookupPending(
  lines: readonly SalesOrderLineDraft[],
  statusBySku: ReadonlyMap<string, "loading" | "missing" | "ready">,
): boolean {
  return lines.some((line) => statusBySku.get(line.sku) === "loading");
}

export function salesOrderConfirmDisabled(input: {
  status: string;
  lineCount: number;
  shipToId: string;
  autosavePending: boolean;
  linesDirty: boolean;
  linesUnresolved: boolean;
  catalogLookupPending: boolean;
  confirmPending: boolean;
  cancelPending: boolean;
}): boolean {
  return (
    input.status !== "draft" ||
    input.lineCount === 0 ||
    input.shipToId.length === 0 ||
    input.autosavePending ||
    input.linesDirty ||
    input.linesUnresolved ||
    input.catalogLookupPending ||
    input.confirmPending ||
    input.cancelPending
  );
}

export function salesOrderCancelDisabled(input: {
  status: string;
  autosavePending: boolean;
  cancelPending: boolean;
  confirmPending: boolean;
  shipPending: boolean;
}): boolean {
  return (
    (input.status !== "draft" && input.status !== "confirmed") ||
    input.autosavePending ||
    input.cancelPending ||
    input.confirmPending ||
    input.shipPending
  );
}

export function salesOrderShipDisabled(input: {
  status: string;
  shipPending: boolean;
  cancelPending: boolean;
}): boolean {
  return input.status !== "confirmed" || input.shipPending || input.cancelPending;
}
