import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export interface ICustomerTermsReadPort {
  getTerms(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<string | null>;
}
