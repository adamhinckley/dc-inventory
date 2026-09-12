import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { AccountStatus } from "../account-status.js";
import type { Customer } from "../customer.js";

export type CustomerListSortBy = "name" | "createdAt" | "creditLimitCents" | "customerNumber";
export type SortOrder = "asc" | "desc";

export type ListCustomersQuery = {
  organizationId: OrganizationId;
  q?: string;
  accountStatus?: AccountStatus;
  page: number;
  pageSize: number;
  sortBy: CustomerListSortBy;
  sortOrder: SortOrder;
};

export type CustomerListPage = {
  items: Customer[];
  total: number;
};

export interface ICustomerRepository {
  list(query: ListCustomersQuery): Promise<CustomerListPage>;
  findById(organizationId: OrganizationId, id: CustomerId): Promise<Customer | null>;
  findByName(organizationId: OrganizationId, name: string): Promise<Customer | null>;
  findByCustomerNumber(
    organizationId: OrganizationId,
    customerNumber: string,
  ): Promise<Customer | null>;
  allocateNextCustomerNumber(organizationId: OrganizationId): Promise<string>;
  save(customer: Customer): Promise<void>;
  deleteById(organizationId: OrganizationId, id: CustomerId): Promise<void>;
}
