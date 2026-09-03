import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { AccountStatus } from "../account-status.js";

export interface ICustomerAccountStatusReadPort {
  getAccountStatus(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<AccountStatus | null>;
}
