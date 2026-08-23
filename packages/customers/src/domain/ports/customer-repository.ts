import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../customer.js";

export type CustomerListSortBy = "name" | "createdAt" | "creditLimitCents";
export type SortOrder = "asc" | "desc";

export type ListCustomersQuery = {
  q?: string;
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
  findById(id: CustomerId): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
