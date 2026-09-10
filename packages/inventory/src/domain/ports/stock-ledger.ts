import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { DemandStockFigures } from "../demand-model.js";
import type { Movement, MovementRefType, MovementType } from "../movement.js";

export type StockCommandFailureReason =
  | "invalid_quantity"
  | "insufficient_on_hand"
  | "insufficient_available"
  | "insufficient_allocated"
  | "insufficient_committed"
  | "insufficient_available_to_sell"
  | "invalid_sell_window"
  | "idempotency_conflict"
  | "provenance_conflict";

export type StockCommandResult =
  | { ok: true; movement?: Movement }
  | {
      ok: false;
      reason: StockCommandFailureReason;
      availableToSell?: number;
      failedIdempotencyKey?: string;
    };

export type StockCommandBase = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  locationId?: LocationId;
  refType: MovementRefType;
  refId: string;
};

export type StockSnapshotLock = {
  organizationId: OrganizationId;
  sku: Sku;
  locationId?: LocationId;
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

export type RecordCommittedCommand = StockCommandBase & {
  refType: "sales_order";
};

export type RecordDecommittedCommand = StockCommandBase & {
  refType: "sales_order";
};

export type ReopenSkusForPresellCommand = {
  organizationId: OrganizationId;
  skus: readonly Sku[];
  windowOpensAt?: Date | null;
  windowClosesAt?: Date | null;
};

export type CloseSkusForPresellCommand = {
  organizationId: OrganizationId;
  skus: readonly Sku[];
};

export type CloseSkusForPresellResult =
  | { ok: true; closedCount: number }
  | { ok: false; reason: StockCommandFailureReason };

export type SetSellWindowCommand = {
  organizationId: OrganizationId;
  sku: Sku;
  locationId?: LocationId;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
};

export type DemandCommandResult =
  | { ok: true }
  | { ok: false; reason: StockCommandFailureReason };

/**
 * Inventory command port. Movement recording and snapshot projection are
 * implemented by adapters; callers use application use cases.
 */
export interface IStockLedger {
  /**
   * Acquires the consistency rows for a command set before any stock-state
   * validation or mutation. Postgres adapters lock distinct rows in stable
   * organization, SKU, and location order; in-memory adapters need no lock.
   */
  lockSnapshots(snapshots: readonly StockSnapshotLock[]): Promise<void>;
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
  recordCommitted(command: RecordCommittedCommand): Promise<StockCommandResult>;
  recordDecommitted(command: RecordDecommittedCommand): Promise<StockCommandResult>;
  recordInboundFromPoBulk(
    commands: readonly RecordInboundFromPoCommand[],
  ): Promise<StockCommandResult>;
  recordGoodsReceivedBulk(
    commands: readonly RecordGoodsReceivedCommand[],
  ): Promise<StockCommandResult>;
  recordInboundCancelledBulk(
    commands: readonly RecordInboundCancelledCommand[],
  ): Promise<StockCommandResult>;
  recordCommittedBulk(commands: readonly RecordCommittedCommand[]): Promise<StockCommandResult>;
  recordDecommittedBulk(commands: readonly RecordDecommittedCommand[]): Promise<StockCommandResult>;
  recordDeallocatedBulk(commands: readonly RecordDeallocatedCommand[]): Promise<StockCommandResult>;
  recordShippedBulk(commands: readonly RecordShippedCommand[]): Promise<StockCommandResult>;
  reopenSkusForPresell(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult>;
  closeSkusForPresell(command: CloseSkusForPresellCommand): Promise<CloseSkusForPresellResult>;
  setSellWindow(command: SetSellWindowCommand): Promise<DemandCommandResult>;
}

export type MovementListFilter = {
  organizationId: OrganizationId;
  sku?: Sku;
  locationId?: LocationId;
  movementType?: MovementType;
  movementTypes?: readonly MovementType[];
  refType?: MovementRefType;
  refId?: string;
};

/**
 * Read-only inventory projection. Snapshots are immutable value objects.
 */
export interface IInventoryReadModel {
  getSnapshot(
    sku: Sku,
    locationId: LocationId,
    organizationId: OrganizationId,
  ): Promise<DemandStockFigures>;
  listMovements(filter: MovementListFilter): Promise<readonly Movement[]>;
}
