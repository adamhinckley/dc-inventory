import { computeSnapshotDelta } from "@dc-inventory/inventory/ledger-rules";
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
  Allocated: 3,
  Deallocated: 4,
  Shipped: 5,
  AdjustmentIncrease: 6,
  AdjustmentDecrease: 7,
};

export function stockKey(sku: string, locationId: string): string {
  return `${sku}\0${locationId}`;
}

export function recomputeStockFromMovements(
  movements: readonly DemoMovementRow[],
): Map<string, StockFigures> | { error: string } {
  const sorted = [...movements].sort((left, right) => {
    const byTime = left.createdAt.getTime() - right.createdAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    return (MOVEMENT_TIE_ORDER[left.movementType] ?? 0) - (MOVEMENT_TIE_ORDER[right.movementType] ?? 0);
  });
  const figures = new Map<string, StockFigures>();
  for (const movement of sorted) {
    const key = stockKey(movement.sku, movement.locationId);
    const current = figures.get(key) ?? ZERO_STOCK_FIGURES;
    const delta = computeSnapshotDelta(movement.movementType, movement.quantity, current);
    if (!delta.ok) {
      return { error: `${movement.sku} ${movement.movementType}: ${delta.reason}` };
    }
    const next = freezeStockFigures(
      current.onHand + (delta.delta.onHand ?? 0),
      current.onOrder + (delta.delta.onOrder ?? 0),
      current.allocated + (delta.delta.allocated ?? 0),
    );
    if (next.onHand < 0 || next.onOrder < 0 || next.allocated < 0) {
      return { error: `${movement.sku} went negative after ${movement.movementType}` };
    }
    figures.set(key, next);
  }
  return figures;
}
