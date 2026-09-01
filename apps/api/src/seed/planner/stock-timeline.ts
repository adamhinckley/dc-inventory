import { LocationId } from "@dc-inventory/shared-kernel";
import { computeSnapshotDelta, type SnapshotDelta } from "@dc-inventory/inventory/ledger-rules";
import {
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  ZERO_DEMAND_STATE,
  type DemandPersistedState,
} from "@dc-inventory/inventory";
import {
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "@dc-inventory/inventory/snapshot";
import type { DemoMovementRow } from "../reconciliation/demo-book.js";
import { recomputeStockFromMovements } from "../reconciliation/stock-from-movements.js";
import { allocateInstant } from "./allocate-instant.js";
import type { DemoBookPlan } from "./types.js";

const LOCATION = LocationId.DEFAULT;

type SkuReplayState = Readonly<{
  figures: StockFigures;
  demand: DemandPersistedState;
}>;

function defaultSkuState(): SkuReplayState {
  return { figures: ZERO_STOCK_FIGURES, demand: ZERO_DEMAND_STATE };
}

function applyDelta(state: SkuReplayState, delta: SnapshotDelta): SkuReplayState {
  const nextFigures = freezeStockFigures(
    state.figures.onHand + (delta.onHand ?? 0),
    state.figures.onOrder + (delta.onOrder ?? 0),
    state.figures.allocated + (delta.allocated ?? 0),
  );
  const nextDemand: DemandPersistedState = Object.freeze({
    committed: state.demand.committed + (delta.committed ?? 0),
    stickyLocked: delta.stickyLocked ?? state.demand.stickyLocked,
    windowOpensAt:
      delta.windowOpensAt !== undefined ? delta.windowOpensAt : state.demand.windowOpensAt,
    windowClosesAt:
      delta.windowClosesAt !== undefined ? delta.windowClosesAt : state.demand.windowClosesAt,
  });
  return { figures: nextFigures, demand: nextDemand };
}

function confirmCoverQuantity(commitQuantity: number, figures: StockFigures): number {
  return Math.min(commitQuantity, figures.available);
}

function receiveCoverQuantity(
  receivedQuantity: number,
  figures: StockFigures,
  committed: number,
): number {
  return Math.min(receivedQuantity, Math.max(0, committed - figures.allocated));
}

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

function applyMovement(
  state: SkuReplayState,
  movementType: DemoMovementRow["movementType"],
  quantity: number,
  at: Date,
): SkuReplayState {
  if (movementType === "Committed") {
    const sellState = computeEffectiveSellState(state.demand, at);
    if (sellState === "locked") {
      const availableToSell = computeLockedAvailableToSell(
        state.figures.onHand,
        state.figures.onOrder,
        state.demand.committed,
      );
      if (quantity > availableToSell) {
        throw new Error(`${movementType} exceeds available to sell on locked SKU`);
      }
    }
  }
  const delta = computeSnapshotDelta(
    movementType,
    quantity,
    state.figures,
    state.demand.committed,
  );
  if (!delta.ok) {
    throw new Error(delta.reason);
  }
  return applyDelta(state, delta.delta);
}

/**
 * Seed-clock movements as reconciliation will sort them: received POs inbound+receive
 * at the PO instant (with FIFO cover allocations); confirmed SOs commit at the SO
 * instant and cover Allocated up to leftover available; shipped SOs ship at the
 * invoice instant (Idle Park ages may precede the SO instant).
 */
export function movementsFromDemoPlan(plan: DemoBookPlan): DemoMovementRow[] {
  const rows: DemoMovementRow[] = [];
  const shipInstantByKey = new Map(
    plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );
  const stateBySku = new Map<string, SkuReplayState>();

  const skuState = (sku: string): SkuReplayState => stateBySku.get(sku) ?? defaultSkuState();
  const setSkuState = (sku: string, state: SkuReplayState): void => {
    stateBySku.set(sku, state);
  };

  for (const order of plan.purchaseOrders) {
    for (const line of order.lines) {
      const at = order.plannedInstant;
      let state = skuState(line.sku);
      state = applyMovement(state, "InboundFromPo", line.qty, at);
      pushMovement(rows, line.sku, "InboundFromPo", line.qty, at);
      if (order.status === "received") {
        state = applyMovement(state, "GoodsReceived", line.qty, at);
        pushMovement(rows, line.sku, "GoodsReceived", line.qty, at);
        const coverQty = receiveCoverQuantity(line.qty, state.figures, state.demand.committed);
        if (coverQty > 0) {
          state = applyMovement(state, "Allocated", coverQty, at);
          pushMovement(rows, line.sku, "Allocated", coverQty, at);
        }
      }
      setSkuState(line.sku, state);
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
      const confirmAt = allocateInstant(
        order.plannedInstant,
        shipAt,
        order.status === "shipped",
      );
      let state = skuState(line.sku);
      state = applyMovement(state, "Committed", line.qty, confirmAt);
      pushMovement(rows, line.sku, "Committed", line.qty, confirmAt);
      const coverQty = confirmCoverQuantity(line.qty, state.figures);
      if (coverQty > 0) {
        state = applyMovement(state, "Allocated", coverQty, confirmAt);
        pushMovement(rows, line.sku, "Allocated", coverQty, confirmAt);
      }
      if (order.status === "shipped") {
        state = applyMovement(state, "Shipped", line.qty, shipAt);
        pushMovement(rows, line.sku, "Shipped", line.qty, shipAt);
      }
      setSkuState(line.sku, state);
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
