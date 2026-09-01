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

type SkuEvent =
  | { kind: "inbound"; sku: string; qty: number; at: Date }
  | { kind: "receive"; sku: string; qty: number; at: Date }
  | { kind: "confirm"; sku: string; qty: number; at: Date }
  | { kind: "ship"; sku: string; qty: number; at: Date };

const EVENT_ORDER: Record<SkuEvent["kind"], number> = {
  inbound: 0,
  receive: 1,
  confirm: 2,
  ship: 3,
};

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

function collectSkuEvents(plan: DemoBookPlan): SkuEvent[] {
  const events: SkuEvent[] = [];
  const shipInstantByKey = new Map(
    plan.shippedInvoices.map((row) => [row.salesOrderKey, row.plannedInstant]),
  );

  for (const order of plan.purchaseOrders) {
    for (const line of order.lines) {
      events.push({
        kind: "inbound",
        sku: line.sku,
        qty: line.qty,
        at: order.plannedInstant,
      });
      if (order.status === "received") {
        events.push({
          kind: "receive",
          sku: line.sku,
          qty: line.qty,
          at: order.plannedInstant,
        });
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
      const confirmAt = allocateInstant(
        order.plannedInstant,
        shipAt,
        order.status === "shipped",
      );
      events.push({ kind: "confirm", sku: line.sku, qty: line.qty, at: confirmAt });
      if (order.status === "shipped") {
        events.push({ kind: "ship", sku: line.sku, qty: line.qty, at: shipAt });
      }
    }
  }

  return events.sort((left, right) => {
    const byTime = left.at.getTime() - right.at.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    return EVENT_ORDER[left.kind] - EVENT_ORDER[right.kind];
  });
}

/**
 * Seed-clock movements as reconciliation will sort them: PO inbound/receive and SO
 * commit/ship interleave by createdAt. Confirm cover Allocated is sized from
 * on_hand present at confirmAt; later GoodsReceived emits FIFO cover Allocated.
 */
export function movementsFromDemoPlan(plan: DemoBookPlan): DemoMovementRow[] {
  const rows: DemoMovementRow[] = [];
  const stateBySku = new Map<string, SkuReplayState>();

  const skuState = (sku: string): SkuReplayState => stateBySku.get(sku) ?? defaultSkuState();
  const setSkuState = (sku: string, state: SkuReplayState): void => {
    stateBySku.set(sku, state);
  };

  for (const event of collectSkuEvents(plan)) {
    let state = skuState(event.sku);
    switch (event.kind) {
      case "inbound":
        state = applyMovement(state, "InboundFromPo", event.qty, event.at);
        pushMovement(rows, event.sku, "InboundFromPo", event.qty, event.at);
        break;
      case "receive": {
        state = applyMovement(state, "GoodsReceived", event.qty, event.at);
        pushMovement(rows, event.sku, "GoodsReceived", event.qty, event.at);
        const fifoCover = receiveCoverQuantity(event.qty, state.figures, state.demand.committed);
        if (fifoCover > 0) {
          state = applyMovement(state, "Allocated", fifoCover, event.at);
          pushMovement(rows, event.sku, "Allocated", fifoCover, event.at);
        }
        break;
      }
      case "confirm":
        state = applyMovement(state, "Committed", event.qty, event.at);
        pushMovement(rows, event.sku, "Committed", event.qty, event.at);
        {
          const coverQty = confirmCoverQuantity(event.qty, state.figures);
          if (coverQty > 0) {
            state = applyMovement(state, "Allocated", coverQty, event.at);
            pushMovement(rows, event.sku, "Allocated", coverQty, event.at);
          }
        }
        break;
      case "ship":
        state = applyMovement(state, "Shipped", event.qty, event.at);
        pushMovement(rows, event.sku, "Shipped", event.qty, event.at);
        break;
    }
    setSkuState(event.sku, state);
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
