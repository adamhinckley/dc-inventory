import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { StockCommandFailureReason } from "../../src/domain/ports/stock-ledger.js";
import type { StockFigures } from "../../src/domain/snapshot.js";

/** Per ADR 0008 / invariants I6: open has no sellability cap; locked uses the three-part formula. */
export type SellState = "open" | "locked";

/**
 * Extended inventory snapshot the demand model adds on top of warehouse leftover figures.
 * Production will expose these fields from the read model once ADA-176 lands.
 */
export type DemandStockFigures = StockFigures &
  Readonly<{
    committed: number;
    sellState: SellState;
    /** `null` means no numeric cap while effectively open. */
    availableToSell: number | null;
    toOrder: number;
    windowOpensAt: Date | null;
    windowClosesAt: Date | null;
    stickyLocked: boolean;
  }>;

export type DemandCommandFailureReason =
  | StockCommandFailureReason
  | "demand_model_not_implemented"
  | "invalid_sell_window"
  | "insufficient_available_to_sell"
  | "insufficient_allocated";

export type DemandCommandResult =
  | { ok: true }
  | { ok: false; reason: DemandCommandFailureReason };

export type DemandSalesOrderCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  locationId?: LocationId;
  refType: "sales_order";
  refId: string;
};

export type ReopenSkusForPresellCommand = {
  organizationId: OrganizationId;
  skus: readonly Sku[];
  windowOpensAt?: Date | null;
  windowClosesAt?: Date | null;
};

export type SetSellWindowCommand = {
  organizationId: OrganizationId;
  sku: Sku;
  locationId?: LocationId;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
};

export type CloseSkusForPresellCommand = {
  organizationId: OrganizationId;
  skus: readonly Sku[];
};

export type CloseSkusForPresellResult =
  | { ok: true; closedCount: number }
  | { ok: false; reason: DemandCommandFailureReason };

export function isDemandStockFigures(snapshot: StockFigures): snapshot is DemandStockFigures {
  return (
    "committed" in snapshot &&
    "sellState" in snapshot &&
    "availableToSell" in snapshot &&
    "toOrder" in snapshot &&
    "stickyLocked" in snapshot
  );
}

export function computeToOrder(committed: number, onHand: number, onOrder: number): number {
  return Math.max(0, committed - onHand - onOrder);
}

export function computeLockedAvailableToSell(
  onHand: number,
  onOrder: number,
  committed: number,
): number {
  return onHand + onOrder - committed;
}
