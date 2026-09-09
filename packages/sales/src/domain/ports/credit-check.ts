import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type ICreditCheckPort = {
  availableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number>;
};
