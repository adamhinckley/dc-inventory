import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type CustomerArProfile = {
  readonly customerId: CustomerId;
  readonly customerNumber: string;
  readonly name: string;
  readonly creditLimitCents: number;
  readonly currency: string;
};

export interface ICustomerArProfileReadPort {
  findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArProfile | null>;
  listAll(organizationId: OrganizationId): Promise<readonly CustomerArProfile[]>;
}
