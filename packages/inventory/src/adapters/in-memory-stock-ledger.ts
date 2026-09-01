import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import {
  computeConfirmCoverQuantity,
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  computeReceiveCoverQuantity,
  coverIdempotencyKey,
  applySetSellWindow,
  isSellWindowInvalid,
  observeWindowClose,
  type DemandPersistedState,
} from "../domain/demand-model.js";
import {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
} from "../domain/ledger-rules.js";
import { MovementId, newUuid } from "../domain/ids.js";
import type { Movement, MovementType } from "../domain/movement.js";
import type {
  DemandCommandResult,
  IStockLedger,
  RecordAdjustmentDecreaseCommand,
  RecordAdjustmentIncreaseCommand,
  RecordAllocatedCommand,
  RecordCommittedCommand,
  RecordDeallocatedCommand,
  RecordDecommittedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
  ReopenSkusForPresellCommand,
  SetSellWindowCommand,
  StockCommandBase,
  StockCommandResult,
  StockSnapshotLock,
} from "../domain/ports/stock-ledger.js";
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

/**
 * In-memory stock ledger. Records append-only movements and projects snapshots
 * in the same unit of work scope as the read model.
 */
export class InMemoryStockLedger implements IStockLedger {
  constructor(
    private readonly readModel: InMemoryInventoryReadModel,
    private readonly clock?: IClock,
  ) {}

  lockSnapshots(_snapshots: readonly StockSnapshotLock[]): Promise<void> {
    return Promise.resolve();
  }

  recordInboundFromPo(command: RecordInboundFromPoCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("InboundFromPo", command);
  }

  recordGoodsReceived(command: RecordGoodsReceivedCommand): Promise<StockCommandResult> {
    return this.recordGoodsReceivedWithCover(command);
  }

  recordInboundCancelled(command: RecordInboundCancelledCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("InboundCancelled", command);
  }

  recordAllocated(command: RecordAllocatedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Allocated", command);
  }

  recordDeallocated(command: RecordDeallocatedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Deallocated", command);
  }

  recordShipped(command: RecordShippedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Shipped", command);
  }

  recordAdjustmentIncrease(
    command: RecordAdjustmentIncreaseCommand,
  ): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("AdjustmentIncrease", command);
  }

  recordAdjustmentDecrease(
    command: RecordAdjustmentDecreaseCommand,
  ): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("AdjustmentDecrease", command);
  }

  recordCommitted(command: RecordCommittedCommand): Promise<StockCommandResult> {
    return this.recordCommittedWithCover(command);
  }

  recordDecommitted(command: RecordDecommittedCommand): Promise<StockCommandResult> {
    return this.recordWithDemandObservation("Decommitted", command);
  }

  async reopenSkusForPresell(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const windowOpensAt = command.windowOpensAt ?? null;
    const windowClosesAt = command.windowClosesAt ?? null;
    if (isSellWindowInvalid(windowOpensAt, windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    for (const sku of command.skus) {
      const demand = this.readModel.getDemandStateSync(sku, LocationId.DEFAULT, organizationId);
      const reopened: DemandPersistedState = Object.freeze({
        committed: demand.committed,
        stickyLocked: false,
        windowOpensAt,
        windowClosesAt,
      });
      this.readModel.setDemandState(sku, LocationId.DEFAULT, reopened, organizationId);
    }
    return { ok: true };
  }

  async setSellWindow(command: SetSellWindowCommand): Promise<DemandCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    if (isSellWindowInvalid(command.windowOpensAt, command.windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    const demand = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const now = this.clock ? this.clock.now() : new Date();
    const nextDemand = applySetSellWindow(
      demand,
      command.windowOpensAt,
      command.windowClosesAt,
      now,
    );
    this.readModel.setDemandState(command.sku, locationId, nextDemand, organizationId);
    return { ok: true };
  }

  private async recordCommittedWithCover(
    command: RecordCommittedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    if (!isPositiveIntegerQuantity(command.quantity)) {
      return { ok: false, reason: "invalid_quantity" };
    }

    const now = this.clock ? this.clock.now() : new Date();
    const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const observedDemand = observeWindowClose(demandBefore, now);
    if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
      this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
    }

    const figures = this.readModel.getSnapshotSync(command.sku, locationId, organizationId);
    const sellState = computeEffectiveSellState(observedDemand, now);
    if (sellState === "locked") {
      const availableToSell = computeLockedAvailableToSell(
        figures.onHand,
        figures.onOrder,
        observedDemand.committed,
      );
      if (command.quantity > availableToSell) {
        return { ok: false, reason: "insufficient_available_to_sell" };
      }
    }

    const committedResult = await this.record("Committed", command);
    if (!committedResult.ok) {
      return committedResult;
    }

    const afterCommit = this.readModel.getSnapshotSync(command.sku, locationId, organizationId);
    const coverQty = computeConfirmCoverQuantity(command.quantity, afterCommit);
    if (coverQty > 0) {
      const coverResult = await this.record("Allocated", {
        organizationId,
        idempotencyKey: coverIdempotencyKey(command.idempotencyKey),
        sku: command.sku,
        quantity: coverQty,
        locationId,
        refType: "sales_order",
        refId: command.refId,
      });
      if (!coverResult.ok) {
        return coverResult;
      }
    }

    return committedResult;
  }

  private async recordGoodsReceivedWithCover(
    command: RecordGoodsReceivedCommand,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    const receiveResult = await this.recordWithDemandObservation("GoodsReceived", command);
    if (!receiveResult.ok) {
      return receiveResult;
    }

    const afterReceive = this.readModel.getSnapshotSync(command.sku, locationId, organizationId);
    const demand = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const coverQty = computeReceiveCoverQuantity(command.quantity, afterReceive, demand.committed);
    if (coverQty > 0) {
      const coverResult = await this.record("Allocated", {
        organizationId,
        idempotencyKey: coverIdempotencyKey(command.idempotencyKey),
        sku: command.sku,
        quantity: coverQty,
        locationId,
        refType: "sales_order",
        refId: command.refId,
      });
      if (!coverResult.ok) {
        return coverResult;
      }
    }

    return receiveResult;
  }

  private recordWithDemandObservation(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;
    const now = this.clock ? this.clock.now() : new Date();
    const demandBefore = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const observedDemand = observeWindowClose(demandBefore, now);
    if (observedDemand.stickyLocked !== demandBefore.stickyLocked) {
      this.readModel.setDemandState(command.sku, locationId, observedDemand, organizationId);
    }
    return this.record(movementType, command);
  }

  private record(
    movementType: MovementType,
    command: StockCommandBase,
  ): Promise<StockCommandResult> {
    const organizationId = requireOrganizationId(command.organizationId);
    const locationId = command.locationId ?? LocationId.DEFAULT;

    if (!isPositiveIntegerQuantity(command.quantity)) {
      return Promise.resolve({ ok: false, reason: "invalid_quantity" });
    }

    const existing = this.readModel.findMovementByIdempotency(
      organizationId,
      command.idempotencyKey,
      command.sku,
    );
    if (existing) {
      if (movementMatchesCommand(existing, movementType, command, locationId, organizationId)) {
        return Promise.resolve({ ok: true, movement: existing });
      }
      return Promise.resolve({ ok: false, reason: "idempotency_conflict" });
    }

    if (
      isOnceOnlyProvenanceType(movementType) &&
      this.readModel.hasProvenance(
        organizationId,
        command.refType,
        command.refId,
        command.sku,
        movementType,
      )
    ) {
      return Promise.resolve({ ok: false, reason: "provenance_conflict" });
    }

    const current = this.readModel.getSnapshotSync(command.sku, locationId, organizationId);
    const demand = this.readModel.getDemandStateSync(command.sku, locationId, organizationId);
    const deltaResult = computeSnapshotDelta(
      movementType,
      command.quantity,
      current,
      demand.committed,
    );
    if (!deltaResult.ok) {
      return Promise.resolve(deltaResult);
    }

    const movement: Movement = Object.freeze({
      id: MovementId.parse(newUuid()),
      organizationId,
      sku: command.sku,
      locationId,
      movementType,
      quantity: command.quantity,
      refType: command.refType,
      refId: command.refId,
      idempotencyKey: command.idempotencyKey,
      createdAt: this.clock ? new Date(this.clock.now().getTime()) : new Date(),
    });

    this.readModel.appendMovement(movement);
    this.readModel.applySnapshotDelta(command.sku, locationId, deltaResult.delta, organizationId);
    return Promise.resolve({ ok: true, movement });
  }
}
