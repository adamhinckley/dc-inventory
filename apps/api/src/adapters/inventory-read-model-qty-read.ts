import { productQtyFromStaffCatalogProjection, type IQtyReadPort, type ProductQty } from "@dc-inventory/catalog";
import {
  projectStaffCatalogQtyFromSnapshot,
  type IClock,
  type IInventoryReadModel,
  type ISellWindowRepository,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import { readActiveSellWindowMembershipBySkus } from "./sell-window-membership-read.js";

/**
 * API adapter for the Catalog-owned qty read port.
 * Reads movement-derived snapshots from the in-memory inventory read model.
 * Every requested SKU is projected from Inventory; callers treat a missing map
 * entry as {@link ZERO_QTY}.
 */
export class InventoryReadModelQtyReadAdapter implements IQtyReadPort {
  constructor(
    private readonly readModel: IInventoryReadModel,
    private readonly sellWindows?: ISellWindowRepository,
    private readonly clock?: IClock,
  ) {}

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, ProductQty>> {
    const now = this.clock?.now() ?? new Date();
    const membershipBySku =
      this.sellWindows === undefined
        ? new Map<string, boolean>()
        : await readActiveSellWindowMembershipBySkus(
            this.sellWindows,
            organizationId,
            skus,
            now,
          );
    const result = new Map<string, ProductQty>();
    for (const sku of skus) {
      const snapshot = await this.readModel.getSnapshot(
        sku,
        LocationId.DEFAULT,
        organizationId,
      );
      const hasActiveSellWindowMembership = membershipBySku.get(sku.value) ?? false;
      const projected = projectStaffCatalogQtyFromSnapshot(
        {
          onHand: snapshot.onHand,
          onOrder: snapshot.onOrder,
          allocated: snapshot.allocated,
          committed: snapshot.committed,
          stickyLocked: snapshot.stickyLocked,
          windowOpensAt: snapshot.windowOpensAt,
          windowClosesAt: snapshot.windowClosesAt,
        },
        now,
        { hasActiveSellWindowMembership },
      );
      result.set(
        sku.value,
        productQtyFromStaffCatalogProjection({
          ...projected,
          stickyLocked: snapshot.stickyLocked,
          windowOpensAt: snapshot.windowOpensAt,
          windowClosesAt: snapshot.windowClosesAt,
          hasActiveSellWindowMembership,
        }),
      );
    }
    return result;
  }
}
