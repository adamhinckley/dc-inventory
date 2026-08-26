import type { CustomerId, Money, OrganizationId } from "@dc-inventory/shared-kernel";

export type Customer = {
  id: CustomerId;
  organizationId: OrganizationId;
  name: string;
  creditLimit: Money;
  terms: string;
};
