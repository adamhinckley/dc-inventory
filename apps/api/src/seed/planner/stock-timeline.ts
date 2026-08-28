import { LocationId } from "@dc-inventory/shared-kernel";
import type { DemoMovementRow } from "../reconciliation/demo-book.js";
import { recomputeStockFromMovements } from "../reconciliation/stock-from-movements.js";
import { allocateInstant } from "./allocate-instant.js";
import type { DemoBookPlan } from "./types.js";

const LOCATION = LocationId.DEFAULT;

function pushMovement(
  rows: DemoMovementRow[],
  sku: string,
  movementType: DemoMovementRow["movementType"],
  quantity: number,
  createdAt: Date,
): void {
  rows.push({
    sku,
    locationId: LOCATION,
    movementType,
    quantity,
    createdAt,
  });
}

/**
 * Seed-clock movements as reconciliation will sort them: received POs inbound+receive
 * at the PO instant; confirmed SOs allocate at the SO instant; shipped SOs allocate
 * at min(SO instant, invoice instant) and ship at the invoice instant (Idle Park ages
 * may precede the SO instant).
 */
export function movementsFromDemoPlan(plan: DemoBookPlan): DemoMovementRow[] {
  const rows: DemoMovementRow[] = [];
  const shipInstantByKey = new Map(
    plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );

  for (const order of plan.purchaseOrders) {
    for (const line of order.lines) {
      pushMovement(rows, line.sku, "InboundFromPo", line.qty, order.plannedInstant);
      if (order.status === "received") {
        pushMovement(rows, line.sku, "GoodsReceived", line.qty, order.plannedInstant);
      }
    }
  }

  for (const order of plan.salesOrders) {
    if (order.status === "leftoverDraft") {
      continue;
    }
    for (const line of order.lines) {
      const shipAt =
        order.status === "shipped"
          ? (shipInstantByKey.get(order.key) ?? order.plannedInstant)
          : order.plannedInstant;
      pushMovement(
        rows,
        line.sku,
        "Allocated",
        line.qty,
        allocateInstant(order.plannedInstant, shipAt, order.status === "shipped"),
      );
      if (order.status === "shipped") {
        pushMovement(rows, line.sku, "Shipped", line.qty, shipAt);
      }
    }
  }

  return rows;
}

export function demoPlanStockTimelineError(plan: DemoBookPlan): string | undefined {
  const recomputed = recomputeStockFromMovements(movementsFromDemoPlan(plan));
  if ("error" in recomputed) {
    return recomputed.error;
  }
  return undefined;
}
