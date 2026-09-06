import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ShipToId } from "../domain/ids.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export class InMemoryShipToRepository implements IShipToRepository {
  private readonly byId = new Map<ShipToId, ShipTo>();

  async listByCustomer(customerId: CustomerId): Promise<ShipTo[]> {
    return [...this.byId.values()].filter((row) => row.customerId === customerId);
  }

  async findById(id: ShipToId): Promise<ShipTo | null> {
    return this.byId.get(id) ?? null;
  }

  async save(shipTo: ShipTo): Promise<void> {
    if (shipTo.isDefault) {
      for (const [id, row] of this.byId) {
        if (row.customerId === shipTo.customerId && row.isDefault && row.id !== shipTo.id) {
          this.byId.set(id, { ...row, isDefault: false });
        }
      }
    }
    this.byId.set(shipTo.id, shipTo);
  }
}
