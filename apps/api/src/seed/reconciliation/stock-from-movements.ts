import { computeSnapshotDelta, isPositiveIntegerQuantity, type SnapshotDelta } from "@dc-inventory/inventory/ledger-rules";
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
import type { DemoMovementRow } from "./demo-book.js";

const MOVEMENT_TIE_ORDER: Record<DemoMovementRow["movementType"], number> = {
  InboundFromPo: 0,
  GoodsReceived: 1,
  InboundCancelled: 2,
  Committed: 3,
  Allocated: 4,
  Decommitted: 5,
  Deallocated: 6,
  Shipped: 7,
  AdjustmentIncrease: 8,
  AdjustmentDecrease: 9,
};

export function stockKey(sku: string, locationId: string): string {
  return `${sku}\0${locationId}`;
}

function sortMovementsForReplay(movements: readonly DemoMovementRow[]): DemoMovementRow[] {
  return [...movements].sort((left, right) => {
    const byTime = left.createdAt.getTime() - right.createdAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    return (MOVEMENT_TIE_ORDER[left.movementType] ?? 0) - (MOVEMENT_TIE_ORDER[right.movementType] ?? 0);
  });
}

function movementError(movement: DemoMovementRow, reason: string): string {
  return `${movement.sku} ${movement.movementType}: ${reason}`;
}

type ReplaySkuState = Readonly<{
  figures: StockFigures;
  demand: DemandPersistedState;
}>;

type ReplayOk = { ok: true; figures: Map<string, StockFigures> };
type ReplayFail = { ok: false; movement: DemoMovementRow; error: string };

function defaultReplayState(): ReplaySkuState {
  return { figures: ZERO_STOCK_FIGURES, demand: ZERO_DEMAND_STATE };
}

function applyDelta(state: ReplaySkuState, delta: SnapshotDelta): ReplaySkuState {
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

function validateNonNegative(state: ReplaySkuState, movement: DemoMovementRow): string | undefined {
  const { figures, demand } = state;
  if (figures.onHand < 0 || figures.onOrder < 0 || figures.allocated < 0 || demand.committed < 0) {
    return `${movement.sku} went negative after ${movement.movementType}`;
  }
  if (figures.available < 0) {
    return `${movement.sku} available went negative after ${movement.movementType}`;
  }
  return undefined;
}

function replayStockFromMovements(movements: readonly DemoMovementRow[]): ReplayOk | ReplayFail {
  const sorted = sortMovementsForReplay(movements);
  const stateByKey = new Map<string, ReplaySkuState>();
  for (const movement of sorted) {
    if (!isPositiveIntegerQuantity(movement.quantity)) {
      return {
        ok: false,
        movement,
        error: movementError(movement, "quantity must be a positive integer"),
      };
    }
    const key = stockKey(movement.sku, movement.locationId);
    const current = stateByKey.get(key) ?? defaultReplayState();

    if (movement.movementType === "Committed") {
      const sellState = computeEffectiveSellState(current.demand, movement.createdAt);
      if (sellState === "locked") {
        const availableToSell = computeLockedAvailableToSell(
          current.figures.onHand,
          current.figures.onOrder,
          current.demand.committed,
        );
        if (movement.quantity > availableToSell) {
          return {
            ok: false,
            movement,
            error: movementError(movement, "insufficient available to sell on locked SKU"),
          };
        }
      }
    }

    const delta = computeSnapshotDelta(
      movement.movementType,
      movement.quantity,
      current.figures,
      current.demand.committed,
    );
    if (!delta.ok) {
      return { ok: false, movement, error: movementError(movement, delta.reason) };
    }

    const next = applyDelta(current, delta.delta);
    const negative = validateNonNegative(next, movement);
    if (negative !== undefined) {
      return { ok: false, movement, error: negative };
    }
    stateByKey.set(key, next);
  }

  const figures = new Map<string, StockFigures>();
  for (const [key, state] of stateByKey) {
    figures.set(key, state.figures);
  }
  return { ok: true, figures };
}

export function firstFailingStockMovement(
  movements: readonly DemoMovementRow[],
): DemoMovementRow | undefined {
  const replayed = replayStockFromMovements(movements);
  return replayed.ok ? undefined : replayed.movement;
}

export function recomputeStockFromMovements(
  movements: readonly DemoMovementRow[],
): Map<string, StockFigures> | { error: string } {
  const replayed = replayStockFromMovements(movements);
  return replayed.ok ? replayed.figures : { error: replayed.error };
}
