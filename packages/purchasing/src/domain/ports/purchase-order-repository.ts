import type {
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import type { PurchaseOrder, PurchaseOrderStatus } from "../purchase-order.js";

export type PurchaseOrderListPage = {
  items: readonly PurchaseOrder[];
  total: number;
};

export type ListPurchaseOrdersQuery = {
  page: number;
  pageSize: number;
  status?: PurchaseOrderStatus;
  supplierId?: SupplierId;
};

export interface IPurchaseOrderRepository {
  list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage>;
  findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  save(order: PurchaseOrder): Promise<void>;
  nextDocumentNumber(): Promise<string>;
  findByDocumentNumber(documentNumber: string): Promise<PurchaseOrder | null>;
}

export interface ISupplierRepository {
  findById(id: SupplierId): Promise<import("../supplier.js").Supplier | null>;
  save(supplier: import("../supplier.js").Supplier): Promise<void>;
  findByVendorNumber(vendorNumber: string): Promise<import("../supplier.js").Supplier | null>;
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
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  purchaseOrderId: PurchaseOrderId;
};

export type GoodsReceivedCommand = {
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  purchaseOrderId: PurchaseOrderId;
};

export type InboundCancelledCommand = {
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
