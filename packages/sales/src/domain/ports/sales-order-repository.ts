import type {
  CustomerId,
  OrderId,
  Sku,
} from "@dc-inventory/shared-kernel";
import type { SalesOrder, SalesOrderStatus } from "../sales-order.js";

export type SalesOrderListPage = {
  items: readonly SalesOrder[];
  total: number;
};

export type ListSalesOrdersQuery = {
  page: number;
  pageSize: number;
  status?: SalesOrderStatus;
  customerId?: CustomerId;
};

export interface ISalesOrderRepository {
  list(query: ListSalesOrdersQuery): Promise<SalesOrderListPage>;
  findById(id: OrderId): Promise<SalesOrder | null>;
  save(order: SalesOrder): Promise<void>;
  nextDocumentNumber(): Promise<string>;
  findByDocumentNumber(documentNumber: string): Promise<SalesOrder | null>;
}

export interface ICustomerLookupPort {
  findById(id: CustomerId): Promise<{ id: CustomerId } | null>;
}

export type InventoryCommandFailureReason =
  | "invalid_quantity"
  | "insufficient_on_hand"
  | "insufficient_available"
  | "idempotency_conflict"
  | "provenance_conflict";

export type InventoryCommandResult =
  | { ok: true }
  | { ok: false; reason: InventoryCommandFailureReason };

export type AllocatedCommand = {
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type DeallocatedCommand = {
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export interface IInventoryCommandPort {
  recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult>;
  recordDeallocated(command: DeallocatedCommand): Promise<InventoryCommandResult>;
}

export interface ISalesUnitOfWork {
  readonly salesOrders: ISalesOrderRepository;
  readonly inventory: IInventoryCommandPort;
  run<T>(work: (uow: ISalesUnitOfWork) => Promise<T>): Promise<T>;
}
