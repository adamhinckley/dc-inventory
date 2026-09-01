import type { ProductQty } from "@dc-inventory/catalog";
import {
  freezeStockFigures,
  projectDemandFigures,
  type DemandPersistedState,
} from "@dc-inventory/inventory";

export type InventorySnapshotQtyRow = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

function toDemandState(row: InventorySnapshotQtyRow): DemandPersistedState {
  return Object.freeze({
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  });
}

/** Pass-through projection from persisted inventory snapshot columns to catalog qty. */
export function productQtyFromSnapshotRow(
  row: InventorySnapshotQtyRow,
  now: Date,
): ProductQty {
  const projected = projectDemandFigures(
    freezeStockFigures(row.onHand, row.onOrder, row.allocated),
    toDemandState(row),
    now,
  );
  return {
    onHand: projected.onHand,
    onOrder: projected.onOrder,
    allocated: projected.allocated,
    available: projected.available,
    committed: projected.committed,
    sellState: projected.sellState,
    availableToSell: projected.availableToSell,
  };
}
