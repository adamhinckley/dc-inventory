import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import type { PurchaseOrder, PurchaseOrderStatus } from "../purchase-order.js";

export type UnnumberedPurchaseOrder = Omit<PurchaseOrder, "documentNumber">;

export type PurchaseOrderListPage = {
  items: readonly PurchaseOrder[];
  total: number;
};

export type ListPurchaseOrdersQuery = {
  organizationId: OrganizationId;
  page: number;
  pageSize: number;
  status?: PurchaseOrderStatus;
  supplierId?: SupplierId;
};

export interface IPurchaseOrderRepository {
  list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage>;
  findById(organizationId: OrganizationId, id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  save(order: PurchaseOrder): Promise<void>;
  insertWithNextDocumentNumber(order: UnnumberedPurchaseOrder): Promise<PurchaseOrder>;
  findByDocumentNumber(
    organizationId: OrganizationId,
    documentNumber: string,
  ): Promise<PurchaseOrder | null>;
}

export type ListSuppliersQuery = {
  organizationId: OrganizationId;
  q?: string;
  page: number;
  pageSize: number;
};

export type SupplierListPage = {
  items: readonly import("../supplier.js").Supplier[];
  total: number;
};

export interface ISupplierRepository {
  list(query: ListSuppliersQuery): Promise<SupplierListPage>;
  findById(organizationId: OrganizationId, id: SupplierId): Promise<import("../supplier.js").Supplier | null>;
  save(supplier: import("../supplier.js").Supplier): Promise<void>;
  findByVendorNumber(
    organizationId: OrganizationId,
    vendorNumber: string,
  ): Promise<import("../supplier.js").Supplier | null>;
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

export type InboundFromPoCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  purchaseOrderId: PurchaseOrderId;
};

export type GoodsReceivedCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  purchaseOrderId: PurchaseOrderId;
};

export type InboundCancelledCommand = {
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  purchaseOrderId: PurchaseOrderId;
};

export interface IInventoryCommandPort {
  recordInboundFromPo(command: InboundFromPoCommand): Promise<InventoryCommandResult>;
  recordGoodsReceived(command: GoodsReceivedCommand): Promise<InventoryCommandResult>;
  recordInboundCancelled(command: InboundCancelledCommand): Promise<InventoryCommandResult>;
}

export interface IPurchasingUnitOfWork {
  readonly purchaseOrders: IPurchaseOrderRepository;
  readonly suppliers: ISupplierRepository;
  readonly inventory: IInventoryCommandPort;
  run<T>(work: (uow: IPurchasingUnitOfWork) => Promise<T>): Promise<T>;
}
