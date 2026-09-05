import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

/** Six-field ship-to address snapshot frozen at confirm (customers.md / sales persistence). */
export type ShipToAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export interface ICustomerShipToSnapshotReadPort {
  getShipToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
    shipToId: string,
  ): Promise<ShipToAddressSnapshot | null>;
}
