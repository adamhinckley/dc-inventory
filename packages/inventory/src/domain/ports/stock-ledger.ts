import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { Movement, MovementRefType } from "../movement.js";
import type { StockFigures } from "../snapshot.js";

export type StockCommandFailureReason =
  | "invalid_quantity"
  | "insufficient_on_hand"
  | "insufficient_available"
  | "idempotency_conflict"
  | "provenance_conflict";

export type StockCommandResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: StockCommandFailureReason };

export type StockCommandBase = {
  organizationId?: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  locationId?: LocationId;
  refType: MovementRefType;
  refId: string;
};

export type RecordInboundFromPoCommand = StockCommandBase & {
  refType: "purchase_order";
};

export type RecordGoodsReceivedCommand = StockCommandBase & {
  refType: "purchase_order";
};

export type RecordInboundCancelledCommand = StockCommandBase & {
  refType: "purchase_order";
};

export type RecordAllocatedCommand = StockCommandBase & {
  refType: "sales_order";
};

export type RecordDeallocatedCommand = StockCommandBase & {
  refType: "sales_order";
};

export type RecordShippedCommand = StockCommandBase & {
  refType: "sales_order";
};

export type RecordAdjustmentIncreaseCommand = StockCommandBase & {
  refType: "adjustment";
};

export type RecordAdjustmentDecreaseCommand = StockCommandBase & {
  refType: "adjustment";
};

/**
 * Inventory command port. Movement recording and snapshot projection are
 * implemented by adapters; callers use application use cases.
 */
export interface IStockLedger {
  recordInboundFromPo(command: RecordInboundFromPoCommand): Promise<StockCommandResult>;
  recordGoodsReceived(command: RecordGoodsReceivedCommand): Promise<StockCommandResult>;
  recordInboundCancelled(command: RecordInboundCancelledCommand): Promise<StockCommandResult>;
  recordAllocated(command: RecordAllocatedCommand): Promise<StockCommandResult>;
  recordDeallocated(command: RecordDeallocatedCommand): Promise<StockCommandResult>;
  recordShipped(command: RecordShippedCommand): Promise<StockCommandResult>;
  recordAdjustmentIncrease(
    command: RecordAdjustmentIncreaseCommand,
  ): Promise<StockCommandResult>;
  recordAdjustmentDecrease(
    command: RecordAdjustmentDecreaseCommand,
  ): Promise<StockCommandResult>;
}

export type MovementListFilter = {
  organizationId?: OrganizationId;
  sku?: Sku;
  locationId?: LocationId;
};

/**
 * Read-only inventory projection. Snapshots are immutable value objects.
 */
export interface IInventoryReadModel {
  getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId?: OrganizationId,
  ): Promise<StockFigures>;
  listMovements(filter?: MovementListFilter): Promise<readonly Movement[]>;
}
