import { LocationId } from "@dc-inventory/shared-kernel";
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
} from "../domain/ports/stock-ledger.js";
import type { InMemoryInventoryReadModel } from "./in-memory-inventory-read-model.js";

/**
 * Stub ledger for ADA-106. Records movements for inspection but does not enforce
 * guards or update snapshot projections — a later packet implements real behavior.
 */
export class InMemoryStockLedger implements IStockLedger {
  constructor(private readonly readModel: InMemoryInventoryReadModel) {}

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
    const movement: Movement = Object.freeze({
      id: MovementId.parse(newUuid()),
      sku: command.sku,
      locationId: command.locationId ?? LocationId.DEFAULT,
      movementType,
      quantity: command.quantity,
      refType: command.refType,
      refId: command.refId,
      idempotencyKey: command.idempotencyKey,
      createdAt: new Date(),
    });
    this.readModel.appendMovement(movement);
    return Promise.resolve({ ok: true, movement });
  }
}
