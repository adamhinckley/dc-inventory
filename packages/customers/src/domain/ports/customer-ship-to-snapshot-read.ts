import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ShipToAddressSnapshot } from "../ship-to-snapshot.js";

export interface ICustomerShipToSnapshotReadPort {
  getShipToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
    shipToId: string,
  ): Promise<ShipToAddressSnapshot | null>;
}
