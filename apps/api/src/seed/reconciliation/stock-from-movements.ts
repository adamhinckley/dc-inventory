import { computeSnapshotDelta, isPositiveIntegerQuantity } from "@dc-inventory/inventory/ledger-rules";
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

type ReplayOk = { ok: true; figures: Map<string, StockFigures> };
type ReplayFail = { ok: false; movement: DemoMovementRow; error: string };

function replayStockFromMovements(movements: readonly DemoMovementRow[]): ReplayOk | ReplayFail {
  const sorted = sortMovementsForReplay(movements);
  const figures = new Map<string, StockFigures>();
  for (const movement of sorted) {
    if (!isPositiveIntegerQuantity(movement.quantity)) {
      return {
        ok: false,
        movement,
        error: movementError(movement, "quantity must be a positive integer"),
      };
    }
    const key = stockKey(movement.sku, movement.locationId);
    const current = figures.get(key) ?? ZERO_STOCK_FIGURES;
    const delta = computeSnapshotDelta(movement.movementType, movement.quantity, current);
    if (!delta.ok) {
      return { ok: false, movement, error: movementError(movement, delta.reason) };
    }
    const next = freezeStockFigures(
      current.onHand + (delta.delta.onHand ?? 0),
      current.onOrder + (delta.delta.onOrder ?? 0),
      current.allocated + (delta.delta.allocated ?? 0),
    );
    if (next.onHand < 0 || next.onOrder < 0 || next.allocated < 0) {
      return {
        ok: false,
        movement,
        error: `${movement.sku} went negative after ${movement.movementType}`,
      };
    }
    figures.set(key, next);
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
