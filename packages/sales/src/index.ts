export { AccountingCommandAdapter } from "./adapters/accounting-command-adapter.js";
export { InMemoryCatalogProductPort } from "./adapters/in-memory-catalog-product-port.js";
export { InMemoryClock } from "./adapters/in-memory-clock.js";
export { DrizzleSalesOrderRepository, type SalesDrizzle } from "./adapters/drizzle-sales-orders.js";
export { InMemorySalesOrderRepository } from "./adapters/in-memory-sales-order-repository.js";
export { InMemorySalesUnitOfWork } from "./adapters/in-memory-sales-unit-of-work.js";
export { CancelSalesOrderUseCase } from "./application/cancel-sales-order.js";
export { ConfirmSalesOrderUseCase } from "./application/confirm-sales-order.js";
export { CreateSalesOrderUseCase } from "./application/create-sales-order.js";
export { GetSalesOrderUseCase } from "./application/get-sales-order.js";
export { ListSalesOrdersUseCase } from "./application/list-sales-orders.js";
export { ShipSalesOrderUseCase } from "./application/ship-sales-order.js";
export { formatDocumentNumber } from "./domain/document-number.js";
export type { IClock } from "./domain/clock.js";
export { SalesOrderLineId } from "./domain/ids.js";
export type {
  ICatalogProductPort,
  ProductSnapshot,
} from "./domain/ports/catalog-product.js";
export type {
  AccountingCommandResult,
  AllocatedCommand,
  CreateInvoiceForOrderCommand,
  DeallocatedCommand,
  IAccountingCommandPort,
  ICustomerLookupPort,
  IInventoryCommandPort,
  InventoryCommandResult,
  ISalesOrderRepository,
  ISalesUnitOfWork,
  ShippedCommand,
  UnnumberedSalesOrder,
} from "./domain/ports/sales-order-repository.js";
export type { SalesOrder, SalesOrderLine, SalesOrderStatus } from "./domain/sales-order.js";
