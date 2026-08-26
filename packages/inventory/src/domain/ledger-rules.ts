import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { ONCE_ONLY_PROVENANCE_TYPES, type Movement, type MovementType } from "./movement.js";
import type { StockCommandBase, StockCommandFailureReason } from "./ports/stock-ledger.js";
import { computeAvailable, type StockFigures } from "./snapshot.js";

export type SnapshotDelta = Partial<Pick<StockFigures, "onHand" | "onOrder" | "allocated">>;

export type LedgerGuardResult =
  | { ok: true; delta: SnapshotDelta }
  | { ok: false; reason: StockCommandFailureReason };

export function isPositiveIntegerQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

export function movementMatchesCommand(
  movement: Movement,
  movementType: MovementType,
  command: StockCommandBase,
  locationId: LocationId,
  organizationId: OrganizationId,
): boolean {
  return (
    movement.organizationId === organizationId &&
    movement.movementType === movementType &&
    movement.sku.equals(command.sku) &&
    movement.locationId === locationId &&
    movement.quantity === command.quantity &&
    movement.refType === command.refType &&
    movement.refId === command.refId &&
    movement.idempotencyKey === command.idempotencyKey
  );
}

export function isOnceOnlyProvenanceType(movementType: MovementType): boolean {
  return (ONCE_ONLY_PROVENANCE_TYPES as readonly MovementType[]).includes(movementType);
}

export function computeSnapshotDelta(
  movementType: MovementType,
  quantity: number,
  current: StockFigures,
): LedgerGuardResult {
  switch (movementType) {
    case "InboundFromPo":
      return { ok: true, delta: { onOrder: quantity } };
    case "GoodsReceived":
      return { ok: true, delta: { onOrder: -quantity, onHand: quantity } };
    case "InboundCancelled":
      return { ok: true, delta: { onOrder: -quantity } };
    case "Allocated": {
      if (current.available < quantity) {
        return { ok: false, reason: "insufficient_available" };
      }
      return { ok: true, delta: { allocated: quantity } };
    }
    case "Deallocated":
      return { ok: true, delta: { allocated: -quantity } };
    case "Shipped":
      return { ok: true, delta: { allocated: -quantity, onHand: -quantity } };
    case "AdjustmentIncrease":
      return { ok: true, delta: { onHand: quantity } };
    case "AdjustmentDecrease": {
      const nextOnHand = current.onHand - quantity;
      const nextAvailable = computeAvailable(nextOnHand, current.allocated);
      if (nextOnHand < 0) {
        return { ok: false, reason: "insufficient_on_hand" };
      }
      if (nextAvailable < 0) {
        return { ok: false, reason: "insufficient_available" };
      }
      return { ok: true, delta: { onHand: -quantity } };
    }
  }
}
