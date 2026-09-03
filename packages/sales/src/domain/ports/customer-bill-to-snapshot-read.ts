import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

/** Six-field bill-to address snapshot (U7 / customers.md §6). */
export type BillToAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export interface ICustomerBillToSnapshotReadPort {
  getBillToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<BillToAddressSnapshot | null>;
}
