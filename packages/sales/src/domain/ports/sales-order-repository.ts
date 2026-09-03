import type { IInventoryCommandPort } from "@dc-inventory/inventory";
import type {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import type { SalesOrder, SalesOrderStatus } from "../sales-order.js";

export type {
  AllocatedCommand,
  CommittedCommand,
  DeallocatedCommand,
  DecommittedCommand,
  IInventoryCommandPort,
  InventoryCommandResult,
  InventorySnapshotLock,
  OrderCoverQuery,
  ShippedCommand,
} from "@dc-inventory/inventory";

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
