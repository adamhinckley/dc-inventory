import { allocateInstant } from "./allocate-instant.js";
import type { DemoBookPlan, PlannedPurchaseOrder } from "./types.js";

function receivedQtyOnOrder(order: PlannedPurchaseOrder, sku: string): number {
  return order.lines
    .filter((line) => line.sku === sku)
    .reduce((sum, line) => sum + line.qty, 0);
}

type StockOp = {
  time: number;
  kind: "alloc" | "ship";
  qty: number;
};

/**
 * Playback writes every PO receive before any SO, so the live ledger has stock.
 * Reconciliation replays by movement createdAt. Pull later receives onto the
 * seed clock so they land before the allocate that needs them.
 */
export function alignDemoPlanStockClock(plan: DemoBookPlan): void {
  const shipInstantByKey = new Map(
    plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );
  const skus = new Set<string>();
  for (const order of plan.purchaseOrders) {
    for (const line of order.lines) {
      skus.add(line.sku);
    }
  }
  for (const order of plan.salesOrders) {
    for (const line of order.lines) {
      skus.add(line.sku);
    }
  }

  for (const sku of skus) {
    alignSku(plan, sku, shipInstantByKey);
  }
}

function alignSku(
  plan: DemoBookPlan,
  sku: string,
  shipInstantByKey: ReadonlyMap<string, Date>,
): void {
  const recvs = plan.purchaseOrders
    .filter((order) => order.status === "received")
    .map((order) => ({ order, qty: receivedQtyOnOrder(order, sku) }))
    .filter((row) => row.qty > 0)
    .sort((left, right) => left.order.plannedInstant.getTime() - right.order.plannedInstant.getTime());

  const ops: StockOp[] = [];
  for (const order of plan.salesOrders) {
    if (order.status === "leftoverDraft") {
      continue;
    }
    const line = order.lines.find((row) => row.sku === sku);
    if (line === undefined) {
      continue;
    }
    const shipAt = shipInstantByKey.get(order.key) ?? order.plannedInstant;
    const allocTime = allocateInstant(
      order.plannedInstant,
      shipAt,
      order.status === "shipped",
    ).getTime();
    ops.push({ time: allocTime, kind: "alloc", qty: line.qty });
    if (order.status === "shipped") {
      ops.push({ time: shipAt.getTime(), kind: "ship", qty: line.qty });
    }
  }
  ops.sort((left, right) => {
    if (left.time !== right.time) {
      return left.time - right.time;
    }
    if (left.kind === right.kind) {
      return 0;
    }
    return left.kind === "alloc" ? -1 : 1;
  });

  let recvIndex = 0;
  let onHand = 0;
  let allocated = 0;
  for (const op of ops) {
    if (op.kind === "ship") {
      allocated -= op.qty;
      onHand -= op.qty;
      continue;
    }
    while (onHand - allocated < op.qty) {
      const next = recvs[recvIndex];
      if (next === undefined) {
        throw new Error(`cannot cover ${sku} allocate at ${new Date(op.time).toISOString()}`);
      }
      recvIndex += 1;
      if (next.order.plannedInstant.getTime() >= op.time) {
        next.order.plannedInstant = new Date(Math.max(plan.historicalStart.getTime(), op.time - 1));
      }
      onHand += next.qty;
    }
    allocated += op.qty;
  }
}
