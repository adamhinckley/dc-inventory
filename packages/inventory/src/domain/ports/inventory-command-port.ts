import type {
  OrderId,
  OrganizationId,
  PurchaseOrderId,
  Sku,
} from "@dc-inventory/shared-kernel";

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

export type InventorySnapshotLock = {
  organizationId: OrganizationId;
  sku: Sku;
};

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

export type OrderCoverQuery = {
  organizationId: OrganizationId;
  sku: Sku;
  orderId: OrderId;
};

/**
 * Cross-context inventory write seam. Purchasing uses inbound methods;
 * Sales uses commit/allocate/ship methods. Inventory adapters delegate
 * to application use cases — callers do not touch the ledger directly.
 */
export interface IInventoryCommandPort {
  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void>;
  recordInboundFromPo(command: InboundFromPoCommand): Promise<InventoryCommandResult>;
  recordGoodsReceived(command: GoodsReceivedCommand): Promise<InventoryCommandResult>;
  recordInboundCancelled(command: InboundCancelledCommand): Promise<InventoryCommandResult>;
  recordCommitted(command: CommittedCommand): Promise<InventoryCommandResult>;
  matchesCommittedIdempotency(command: CommittedCommand): Promise<boolean>;
  recordDecommitted(command: DecommittedCommand): Promise<InventoryCommandResult>;
  matchesDecommittedIdempotency(command: DecommittedCommand): Promise<boolean>;
  recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult>;
  recordDeallocated(command: DeallocatedCommand): Promise<InventoryCommandResult>;
  recordShipped(command: ShippedCommand): Promise<InventoryCommandResult>;
  getOrderCoverQuantity(query: OrderCoverQuery): Promise<number>;
}
