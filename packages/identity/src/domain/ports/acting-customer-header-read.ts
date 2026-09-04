import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type ActingCustomerHeader = {
  customerId: CustomerId;
  businessName: string;
  customerNumber: string;
};

export interface IActingCustomerHeaderReadPort {
  list(organizationId: OrganizationId): Promise<readonly ActingCustomerHeader[]>;
  findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<ActingCustomerHeader | null>;
}
