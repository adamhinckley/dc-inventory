export { InMemoryInventoryReadModel } from "./adapters/in-memory-inventory-read-model.js";
export { InMemoryInventoryUnitOfWork } from "./adapters/in-memory-inventory-unit-of-work.js";
export type { InventoryUnitOfWorkScope } from "./adapters/in-memory-inventory-unit-of-work.js";
export { InMemoryStockLedger } from "./adapters/in-memory-stock-ledger.js";
export { GetStockSnapshotUseCase } from "./application/get-stock-snapshot.js";
export { RecordAdjustmentDecreaseUseCase } from "./application/record-adjustment-decrease.js";
export { RecordAdjustmentIncreaseUseCase } from "./application/record-adjustment-increase.js";
export { RecordAllocatedUseCase } from "./application/record-allocated.js";
export { RecordDeallocatedUseCase } from "./application/record-deallocated.js";
export { RecordGoodsReceivedUseCase } from "./application/record-goods-received.js";
export { RecordInboundCancelledUseCase } from "./application/record-inbound-cancelled.js";
export { RecordInboundFromPoUseCase } from "./application/record-inbound-from-po.js";
export { RecordShippedUseCase } from "./application/record-shipped.js";
export { MovementId } from "./domain/ids.js";
export {
  MOVEMENT_REF_TYPES,
  MOVEMENT_TYPES,
  ONCE_ONLY_PROVENANCE_TYPES,
  type IdempotencyRecord,
  type Movement,
  type MovementRefType,
  type MovementType,
} from "./domain/movement.js";
export type {
  IInventoryReadModel,
  IStockLedger,
  MovementListFilter,
  RecordAdjustmentDecreaseCommand,
  RecordAdjustmentIncreaseCommand,
  RecordAllocatedCommand,
  RecordDeallocatedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
  StockCommandBase,
  StockCommandFailureReason,
  StockCommandResult,
} from "./domain/ports/stock-ledger.js";
export {
  computeAvailable,
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "./domain/snapshot.js";
