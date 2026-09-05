import type { CustomerId } from "@dc-inventory/shared-kernel";
import type {
  ICustomerShipToSnapshotReadPort,
  ShipToAddressSnapshot,
} from "../domain/ports/customer-ship-to-snapshot-read.js";

type SeededShipTo = {
  customerId: CustomerId;
  snapshot: ShipToAddressSnapshot;
};

export class InMemoryCustomerShipToSnapshotReadPort
  implements ICustomerShipToSnapshotReadPort
{
  private readonly byId = new Map<string, SeededShipTo>();

  seed(customerId: CustomerId, shipToId: string, snapshot: ShipToAddressSnapshot): void {
    this.byId.set(shipToId, { customerId, snapshot });
  }

  async getShipToAddressSnapshot(
    _organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
    customerId: CustomerId,
    shipToId: string,
  ): Promise<ShipToAddressSnapshot | null> {
    const row = this.byId.get(shipToId);
    if (row === undefined || row.customerId !== customerId) {
      return null;
    }
    return row.snapshot;
  }
}
