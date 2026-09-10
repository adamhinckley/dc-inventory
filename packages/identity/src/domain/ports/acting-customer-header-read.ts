import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { WholesaleLoginAccountStatus } from "../account-status.js";

export type ActingCustomerHeader = {
  customerId: CustomerId;
  businessName: string;
  customerNumber: string;
};

export type ActingCustomerPickerRow = ActingCustomerHeader & {
  accountStatus: WholesaleLoginAccountStatus;
};

export interface IActingCustomerHeaderReadPort {
  listPickerItems(organizationId: OrganizationId): Promise<readonly ActingCustomerPickerRow[]>;
  findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<ActingCustomerHeader | null>;
}
