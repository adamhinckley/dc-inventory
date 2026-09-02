import type { OrganizationId, PurchaseOrderId } from "@dc-inventory/shared-kernel";

/** Read-only existence check for purchase orders (Purchasing context). */
export interface IPurchaseOrderLookup {
  exists(organizationId: OrganizationId, purchaseOrderId: PurchaseOrderId): Promise<boolean>;
}
