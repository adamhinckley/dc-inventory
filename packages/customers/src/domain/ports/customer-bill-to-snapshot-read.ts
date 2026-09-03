import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { BillToAddressSnapshot } from "../bill-to.js";

export interface ICustomerBillToSnapshotReadPort {
  getBillToAddressSnapshot(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<BillToAddressSnapshot | null>;
}
