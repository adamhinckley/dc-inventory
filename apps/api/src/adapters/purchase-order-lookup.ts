import type { IPurchaseOrderLookup } from "@dc-inventory/inventory";
import type { OrganizationId, PurchaseOrderId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "@dc-inventory/purchasing";

export class PurchaseOrderLookupAdapter implements IPurchaseOrderLookup {
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

  async exists(
    organizationId: OrganizationId,
    purchaseOrderId: PurchaseOrderId,
  ): Promise<boolean> {
    return this.purchaseOrders.exists(organizationId, purchaseOrderId);
  }
}
