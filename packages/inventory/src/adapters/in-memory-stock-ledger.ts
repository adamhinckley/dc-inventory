import { LocationId, OrganizationId, requireOrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
} from "../domain/ledger-rules.js";
import { MovementId, newUuid } from "../domain/ids.js";
import type { Movement, MovementType } from "../domain/movement.js";
import type {
  IStockLedger,
  RecordAdjustmentDecreaseCommand,
  RecordAdjustmentIncreaseCommand,
  RecordAllocatedCommand,
  RecordDeallocatedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
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
    return this.record("InboundFromPo", command);
  }

  recordGoodsReceived(command: RecordGoodsReceivedCommand): Promise<StockCommandResult> {
    return this.record("GoodsReceived", command);
  }

  recordInboundCancelled(command: RecordInboundCancelledCommand): Promise<StockCommandResult> {
    return this.record("InboundCancelled", command);
  }

  recordAllocated(command: RecordAllocatedCommand): Promise<StockCommandResult> {
    return this.record("Allocated", command);
  }

  recordDeallocated(command: RecordDeallocatedCommand): Promise<StockCommandResult> {
    return this.record("Deallocated", command);
  }

  recordShipped(command: RecordShippedCommand): Promise<StockCommandResult> {
    return this.record("Shipped", command);
  }

  recordAdjustmentIncrease(
    command: RecordAdjustmentIncreaseCommand,
  ): Promise<StockCommandResult> {
    return this.record("AdjustmentIncrease", command);
  }

  recordAdjustmentDecrease(
    command: RecordAdjustmentDecreaseCommand,
  ): Promise<StockCommandResult> {
    return this.record("AdjustmentDecrease", command);
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
    const deltaResult = computeSnapshotDelta(movementType, command.quantity, current);
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
    this.readModel.applySnapshotDelta(
      command.sku,
      locationId,
      deltaResult.delta,
      organizationId,
    );
    return Promise.resolve({ ok: true, movement });
  }
}
