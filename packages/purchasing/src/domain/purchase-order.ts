export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "confirmed",
  "received",
  "cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type PurchaseOrderLine = {
  readonly id: import("./ids.js").PurchaseOrderLineId;
  readonly sku: import("@dc-inventory/shared-kernel").Sku;
  readonly name: string;
  readonly qty: number;
  readonly receivedQty: number;
};

export type PurchaseOrder = {
  readonly id: import("@dc-inventory/shared-kernel").PurchaseOrderId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly supplierId: import("@dc-inventory/shared-kernel").SupplierId;
  readonly documentNumber: string;
  readonly status: PurchaseOrderStatus;
  readonly shipDate: string | null;
  readonly cancelDate: string | null;
  readonly createdAt: Date;
  readonly lines: readonly PurchaseOrderLine[];
};

export function unreceivedQty(line: PurchaseOrderLine): number {
  return line.qty - line.receivedQty;
}

export function isFullyReceived(po: PurchaseOrder): boolean {
  return po.lines.length > 0 && po.lines.every((line) => line.receivedQty >= line.qty);
}
