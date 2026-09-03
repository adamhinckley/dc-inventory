import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { WholesaleLoginAccountStatus } from "../account-status.js";

export interface IWholesaleLoginAccountStatusReadPort {
  getAccountStatus(
    organizationId: OrganizationId,
    linkedPartyId: CustomerId,
  ): Promise<WholesaleLoginAccountStatus | null>;
}
