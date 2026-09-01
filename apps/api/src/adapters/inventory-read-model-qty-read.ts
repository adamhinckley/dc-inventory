import type { IQtyReadPort, ProductQty } from "@dc-inventory/catalog";
import type { IInventoryReadModel } from "@dc-inventory/inventory";
import { LocationId, OrganizationId, type Sku } from "@dc-inventory/shared-kernel";

/**
 * API adapter for the Catalog-owned qty read port.
 * Reads movement-derived snapshots from the in-memory inventory read model.
 * Missing or all-zero snapshots are omitted — callers treat that as 0.
 */
export class InventoryReadModelQtyReadAdapter implements IQtyReadPort {
  constructor(private readonly readModel: IInventoryReadModel) {}

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, ProductQty>> {
    const result = new Map<string, ProductQty>();
    for (const sku of skus) {
      const snapshot = await this.readModel.getSnapshot(
        sku,
        LocationId.DEFAULT,
        organizationId,
      );
      if (snapshot.onHand === 0 && snapshot.onOrder === 0 && snapshot.allocated === 0) {
        continue;
      }
      result.set(sku.value, {
        onHand: snapshot.onHand,
        onOrder: snapshot.onOrder,
        allocated: snapshot.allocated,
        available: snapshot.available,
        committed: snapshot.committed,
        sellState: snapshot.sellState,
        availableToSell: snapshot.availableToSell,
      });
    }
    return result;
  }
}
