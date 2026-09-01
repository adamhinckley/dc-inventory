export { InMemoryClock } from "./adapters/in-memory-clock.js";
export { InMemoryInventoryReadModel } from "./adapters/in-memory-inventory-read-model.js";
export { InMemoryInventoryUnitOfWork } from "./adapters/in-memory-inventory-unit-of-work.js";
export type { InventoryUnitOfWorkScope } from "./adapters/in-memory-inventory-unit-of-work.js";
export { InMemoryStockLedger } from "./adapters/in-memory-stock-ledger.js";
export { DrizzleInventoryReadModel } from "./adapters/drizzle-inventory-read-model.js";
export type { InventoryReadDrizzle } from "./adapters/drizzle-inventory-read-model.js";
export { DrizzleStockLedger } from "./adapters/drizzle-stock-ledger.js";
export type { InventoryDrizzle } from "./adapters/drizzle-stock-ledger.js";
export {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
  runPhase2Bootstrap,
  type Phase2BootstrapPorts,
  type Phase2BootstrapResult,
} from "./bootstrap/run-phase2-bootstrap.js";
export { GetStockSnapshotUseCase } from "./application/get-stock-snapshot.js";
export { RecordAdjustmentDecreaseUseCase } from "./application/record-adjustment-decrease.js";
export { RecordAdjustmentIncreaseUseCase } from "./application/record-adjustment-increase.js";
export { RecordAllocatedUseCase } from "./application/record-allocated.js";
export { RecordCommittedUseCase } from "./application/record-committed.js";
export { RecordDeallocatedUseCase } from "./application/record-deallocated.js";
export { RecordDecommittedUseCase } from "./application/record-decommitted.js";
export { RecordGoodsReceivedUseCase } from "./application/record-goods-received.js";
export { RecordInboundCancelledUseCase } from "./application/record-inbound-cancelled.js";
export { RecordInboundFromPoUseCase } from "./application/record-inbound-from-po.js";
export { RecordReopenSkusForPresellUseCase } from "./application/record-reopen-skus-for-presell.js";
export { RecordShippedUseCase } from "./application/record-shipped.js";
export { SetSellWindowUseCase } from "./application/set-sell-window.js";
export {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
} from "./domain/ledger-rules.js";
export { MovementId } from "./domain/ids.js";
export type { IClock } from "./domain/clock.js";
export {
  applySetSellWindow,
  computeAvailableToSell,
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  computeUncovered,
  isSellWindowInvalid,
  observeWindowClose,
  projectDemandFigures,
  ZERO_DEMAND_STATE,
  type DemandPersistedState,
  type DemandStockFigures,
  type SellState,
} from "./domain/demand-model.js";
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
  RecordCommittedCommand,
  RecordDeallocatedCommand,
  RecordDecommittedCommand,
  RecordGoodsReceivedCommand,
  RecordInboundCancelledCommand,
  RecordInboundFromPoCommand,
  RecordShippedCommand,
  ReopenSkusForPresellCommand,
  SetSellWindowCommand,
  DemandCommandResult,
  StockCommandBase,
  StockCommandFailureReason,
  StockCommandResult,
  StockSnapshotLock,
} from "./domain/ports/stock-ledger.js";
export {
  computeAvailable,
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "./domain/snapshot.js";
