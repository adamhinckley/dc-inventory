export { InMemoryClock } from "./adapters/in-memory-clock.js";
export { InMemoryInventoryReadModel } from "./adapters/in-memory-inventory-read-model.js";
export { InMemoryInventoryUnitOfWork } from "./adapters/in-memory-inventory-unit-of-work.js";
export { StockLedgerInventoryCommandAdapter } from "./adapters/stock-ledger-inventory-command-adapter.js";
export type { InventoryUnitOfWorkScope } from "./adapters/in-memory-inventory-unit-of-work.js";
export { InMemoryStockLedger } from "./adapters/in-memory-stock-ledger.js";
export { InMemorySellWindowRepository } from "./adapters/in-memory-sell-window-repository.js";
export { DrizzleSellWindowRepository, type SellWindowDrizzle } from "./adapters/drizzle-sell-window-repository.js";
export { InMemoryUncoveredListQuery } from "./adapters/in-memory-uncovered-list-query.js";
export {
  InMemoryUncoveredCaseQtyReadPort,
  InMemoryUncoveredReorderPolicyReadPort,
} from "./adapters/in-memory-uncovered-stock-context.js";
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
export {
  CreateSellWindowUseCase,
  type CreateSellWindowRequest,
  type CreateSellWindowResult,
} from "./application/create-sell-window.js";
export {
  ListSellWindowsUseCase,
  type ListSellWindowsRequest,
  type ListSellWindowsResult,
} from "./application/list-sell-windows.js";
export {
  GetSellWindowUseCase,
  type GetSellWindowRequest,
  type GetSellWindowResult,
} from "./application/get-sell-window.js";
export {
  CloseSellWindowUseCase,
  type CloseSellWindowRequest,
  type CloseSellWindowResult,
} from "./application/close-sell-window.js";
export {
  ListPurchaseOrderGoodsReceivedUseCase,
  type ListPurchaseOrderGoodsReceivedRequest,
  type ListPurchaseOrderGoodsReceivedResult,
  type PurchaseOrderGoodsReceivedItem,
} from "./application/list-purchase-order-goods-received.js";
export { ListUncoveredSkusUseCase } from "./application/list-uncovered-skus.js";
export {
  ListUncoveredFactoriesUseCase,
  UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
  type ListUncoveredFactoriesRequest,
  type ListUncoveredFactoriesResult,
  type UncoveredFactorySummaryRow,
} from "./application/list-uncovered-factories.js";
export { RecordAdjustmentDecreaseUseCase } from "./application/record-adjustment-decrease.js";
export { RecordAdjustmentIncreaseUseCase } from "./application/record-adjustment-increase.js";
export { RecordAllocatedUseCase } from "./application/record-allocated.js";
export { RecordCommittedUseCase } from "./application/record-committed.js";
export { RecordDeallocatedUseCase } from "./application/record-deallocated.js";
export { RecordDecommittedUseCase } from "./application/record-decommitted.js";
export { RecordGoodsReceivedUseCase } from "./application/record-goods-received.js";
export { RecordInboundCancelledUseCase } from "./application/record-inbound-cancelled.js";
export { RecordInboundFromPoUseCase } from "./application/record-inbound-from-po.js";
export {
  RecordReopenSkusForPresellUseCase,
  type RecordReopenSkusForPresellRequest,
  type RecordReopenSkusForPresellResult,
} from "./application/record-reopen-skus-for-presell.js";
export { RecordShippedUseCase } from "./application/record-shipped.js";
export { SetSellWindowUseCase } from "./application/set-sell-window.js";
export {
  computeSnapshotDelta,
  isOnceOnlyProvenanceType,
  isPositiveIntegerQuantity,
  movementMatchesCommand,
} from "./domain/ledger-rules.js";
export { MovementId, SellWindowId } from "./domain/ids.js";
export type { IClock } from "./domain/clock.js";
export {
  applySetSellWindow,
  compareStaffCatalogQtyAvailableToSell,
  compareStaffCatalogQtySellState,
  computeAvailableToSell,
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  computeUncovered,
  hasActiveSellWindowMembership,
  isSellWindowInvalid,
  isSnapshotSellWindowOpen,
  observeWindowClose,
  projectDemandFigures,
  projectStaffCatalogQtyFromSnapshot,
  staffCatalogQtyDemandState,
  ZERO_DEMAND_STATE,
  ZERO_STAFF_CATALOG_QTY_CELL,
  type DemandPersistedState,
  type DemandStockFigures,
  type EffectiveSellStateOptions,
  type SellState,
  type StaffCatalogQtyCell,
  type StaffCatalogQtySnapshotRow,
  type StaffCatalogQtySortOrder,
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
export {
  allocateReceiveCover,
  gateCommittedQuantity,
  planConfirmCoverAllocation,
  planReceiveCoverAllocations,
  recordCommittedWithCover,
  type CoverAllocatedCommand,
  type CoverPolicyReadState,
  type CoverPolicyRecorder,
} from "./domain/cover-policy.js";
export {
  listFifoUncoveredCommittedOrders,
  netOrderCommittedQuantity,
  netOrderCoverQuantity,
  type FifoUncoveredOrder,
  type OrderCoverMovement,
} from "./domain/order-cover.js";
export type {
  AllocatedCommand,
  CommittedCommand,
  DeallocatedCommand,
  DecommittedCommand,
  GoodsReceivedCommand,
  IInventoryCommandPort,
  InboundCancelledCommand,
  InboundFromPoCommand,
  InventoryCommandFailureReason,
  InventoryCommandResult,
  InventorySnapshotLock,
  OrderCoverQuery,
  ShippedCommand,
} from "./domain/ports/inventory-command-port.js";
export type { IPurchaseOrderLookup } from "./domain/ports/purchase-order-lookup.js";
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
export type {
  IUncoveredListQuery,
  UncoveredListCoreRow,
  UncoveredListPage,
  UncoveredListQuery,
  UncoveredListRow,
  UncoveredSkuDraftPurchaseOrderRef,
} from "./domain/ports/uncovered-list-query.js";
export type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
  UncoveredSkuDraftPurchaseOrderRef as UncoveredSkuEnrichmentDraftPurchaseOrderRef,
  UncoveredSkuMappingStatus,
  UncoveredSkuSupplierInfo,
  UncoveredSkuSupplierMapping,
  UncoveredSkuSupplierSku,
} from "./domain/ports/uncovered-sku-enrichment.js";
export { uncoveredSkuDraftKey } from "./domain/ports/uncovered-sku-enrichment.js";
export {
  computeSellWindowStatus,
  projectLiveSellWindowStatus,
  type SellWindow,
  type SellWindowFilterSnapshot,
  type SellWindowStatus,
} from "./domain/sell-window.js";
export type {
  CreateSellWindowRecord,
  ISellWindowRepository,
  ListSellWindowsQuery,
  SellWindowDetail,
  SellWindowListPage,
  SellWindowListSortBy,
} from "./domain/ports/sell-window-repository.js";
export { normalizeSellWindowFilterSnapshot } from "./domain/ports/sell-window-repository.js";
export type {
  IUncoveredCaseQtyReadPort,
  IUncoveredReorderPolicyReadPort,
  UncoveredCaseQty,
  UncoveredReorderPolicy,
} from "./domain/ports/uncovered-stock-context.js";
export {
  computeAvailable,
  freezeStockFigures,
  ZERO_STOCK_FIGURES,
  type StockFigures,
} from "./domain/snapshot.js";
export {
  availableToSellProjectionSql,
  hasActiveSellWindowMembershipSql,
  isLockedForSellSql,
  isShopSellableSql,
  isSnapshotSellWindowOpenSql,
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
  type DemandProjectionCatalogColumns,
  type DemandProjectionSnapshotColumns,
  type StaffCatalogDemandProjectionSql,
} from "./persistence/demand-projection-sql.js";
