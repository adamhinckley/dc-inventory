import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { BillAddressSnapshot } from "../bill-address-snapshot.js";

export interface ICustomerBillToSnapshotReadPort {
  getBillToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<BillAddressSnapshot | null>;
}
