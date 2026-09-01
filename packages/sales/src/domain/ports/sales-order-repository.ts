import type {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import type { SalesOrder, SalesOrderStatus } from "../sales-order.js";

export type UnnumberedSalesOrder = Omit<SalesOrder, "documentNumber">;

export type SalesOrderListPage = {
  items: readonly SalesOrder[];
  total: number;
};

export type ListSalesOrdersQuery = {
  organizationId: OrganizationId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy?: "documentNumber" | "status";
  sortOrder?: "asc" | "desc";
  status?: SalesOrderStatus;
  customerId?: CustomerId;
};

export interface ISalesOrderRepository {
  list(query: ListSalesOrdersQuery): Promise<SalesOrderListPage>;
  findById(organizationId: OrganizationId, id: OrderId): Promise<SalesOrder | null>;
  save(order: SalesOrder): Promise<void>;
  insertWithNextDocumentNumber(order: UnnumberedSalesOrder): Promise<SalesOrder>;
  findByDocumentNumber(
    organizationId: OrganizationId,
    documentNumber: string,
  ): Promise<SalesOrder | null>;
}

export interface ICustomerLookupPort {
  findById(
    organizationId: OrganizationId,
    id: CustomerId,
  ): Promise<{ id: CustomerId } | null>;
}

export type InventoryCommandFailureReason =
  | "invalid_quantity"
  | "insufficient_on_hand"
  | "insufficient_available"
  | "insufficient_available_to_sell"
  | "idempotency_conflict"
  | "provenance_conflict";

export type InventoryCommandResult =
  | { ok: true }
  | { ok: false; reason: InventoryCommandFailureReason };

export type AllocatedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type CommittedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type DecommittedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type DeallocatedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type ShippedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  orderId: OrderId;
};

export type InventorySnapshotLock = {
  organizationId: OrganizationId;
  sku: Sku;
};

export type CreateInvoiceForOrderCommand = {
  organizationId: OrganizationId;
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type AccountingCommandResult =
  | {
      ok: true;
      invoiceId: InvoiceId;
      documentNumber: string;
      created: boolean;
    }
  | { ok: false; reason: "invalid" };

export type OrderCoverQuery = {
  organizationId: OrganizationId;
  sku: Sku;
  orderId: OrderId;
};

export interface IInventoryCommandPort {
  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void>;
  recordCommitted(command: CommittedCommand): Promise<InventoryCommandResult>;
  matchesCommittedIdempotency(command: CommittedCommand): Promise<boolean>;
  recordDecommitted(command: DecommittedCommand): Promise<InventoryCommandResult>;
  recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult>;
  recordDeallocated(command: DeallocatedCommand): Promise<InventoryCommandResult>;
  recordShipped(command: ShippedCommand): Promise<InventoryCommandResult>;
  getOrderCoverQuantity(query: OrderCoverQuery): Promise<number>;
}

export interface IAccountingCommandPort {
  createInvoiceForOrder(
    command: CreateInvoiceForOrderCommand,
  ): Promise<AccountingCommandResult>;
}

export interface ISalesUnitOfWork {
  readonly salesOrders: ISalesOrderRepository;
  readonly inventory: IInventoryCommandPort;
  readonly accounting: IAccountingCommandPort;
  run<T>(work: (uow: ISalesUnitOfWork) => Promise<T>): Promise<T>;
}
