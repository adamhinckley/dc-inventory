import type { CustomerId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type CommittedCustomerName = Readonly<{
  customerId: CustomerId;
  name: string;
}>;

export type CommittedCustomerNamesQuery = Readonly<{
  organizationId: OrganizationId;
  skus: readonly Sku[];
}>;

/**
 * Customers with live committed lines on the requested SKUs.
 * Confirmed orders only; decommitted lines are excluded when the adapter can see them.
 */
export interface ICommittedCustomerNamesListQuery {
  list(query: CommittedCustomerNamesQuery): Promise<readonly CommittedCustomerName[]>;
}
