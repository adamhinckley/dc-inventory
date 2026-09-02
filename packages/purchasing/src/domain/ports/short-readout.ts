import type { CustomerId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type CommittedCustomerName = Readonly<{
  customerId: CustomerId;
  name: string;
}>;

export interface IInventoryUncoveredReadPort {
  getUncovered(organizationId: OrganizationId, sku: Sku): Promise<number>;
}

export interface ICommittedCustomerNamesPort {
  listCommittedCustomerNames(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<readonly CommittedCustomerName[]>;
}
