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
 * Customers on confirmed sales orders that have order lines on the requested SKUs.
 *
 * Line-level decommit (`SalesOrderLine.decommitted`) is not persisted on
 * `sales.order_lines` yet, so neither adapter can exclude decommitted lines at
 * this read boundary. Both adapters therefore apply the same rule: confirmed
 * order + matching line SKU.
 */
export interface ICommittedCustomerNamesListQuery {
  list(query: CommittedCustomerNamesQuery): Promise<readonly CommittedCustomerName[]>;
}
