import type { IInventoryCommandPort } from "@dc-inventory/inventory";
import type {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import type { PurchaseOrder, PurchaseOrderStatus } from "../purchase-order.js";

export type {
  GoodsReceivedCommand,
  IInventoryCommandPort,
  InboundCancelledCommand,
  InboundFromPoCommand,
  InventoryCommandResult,
  InventorySnapshotLock,
} from "@dc-inventory/inventory";

export type UnnumberedPurchaseOrder = Omit<PurchaseOrder, "documentNumber">;

export type PurchaseOrderListPage = {
  items: readonly PurchaseOrder[];
  total: number;
};

export const purchaseOrderListSortFields = [
  "documentNumber",
  "status",
  "supplierName",
  "shipDate",
  "cancelDate",
  "remaining",
] as const;

export type PurchaseOrderListSortBy = (typeof purchaseOrderListSortFields)[number];

export type ListPurchaseOrdersQuery = {
  organizationId: OrganizationId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy?: PurchaseOrderListSortBy;
  sortOrder?: "asc" | "desc";
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
  sortBy?: "vendorNumber" | "name";
  sortOrder?: "asc" | "desc";
};

export type SupplierListPage = {
  items: readonly import("../supplier.js").Supplier[];
  total: number;
};

export interface ISupplierRepository {
  list(query: ListSuppliersQuery): Promise<SupplierListPage>;
  findById(organizationId: OrganizationId, id: SupplierId): Promise<import("../supplier.js").Supplier | null>;
  findByIds(
    organizationId: OrganizationId,
    ids: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, import("../supplier.js").Supplier>>;
  save(supplier: import("../supplier.js").Supplier): Promise<void>;
  findByVendorNumber(
    organizationId: OrganizationId,
    vendorNumber: string,
  ): Promise<import("../supplier.js").Supplier | null>;
}

export interface IPurchasingUnitOfWork {
  readonly purchaseOrders: IPurchaseOrderRepository;
  readonly suppliers: ISupplierRepository;
  readonly inventory: IInventoryCommandPort;
  run<T>(work: (uow: IPurchasingUnitOfWork) => Promise<T>): Promise<T>;
}
