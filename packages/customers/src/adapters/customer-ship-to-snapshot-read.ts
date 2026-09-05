import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { ShipToId } from "../domain/ids.js";
import type { ICustomerShipToSnapshotReadPort } from "../domain/ports/customer-ship-to-snapshot-read.js";
import type { ShipToAddressSnapshot } from "../domain/ship-to-snapshot.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";

export class CustomerShipToSnapshotReadAdapter implements ICustomerShipToSnapshotReadPort {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
  ) {}

  async getShipToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
    shipToId: string,
  ): Promise<ShipToAddressSnapshot | null> {
    const customer = await this.customers.findById(organizationId, customerId);
    if (customer === null) {
      return null;
    }
    const shipTo = await this.shipTos.findById(ShipToId.parse(shipToId));
    if (shipTo === null || shipTo.customerId !== customerId) {
      return null;
    }
    return {
      line1: shipTo.line1,
      line2: shipTo.line2,
      city: shipTo.city,
      region: shipTo.region,
      postal: shipTo.postal,
      country: shipTo.country,
    };
  }
}
