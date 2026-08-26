import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type {
  CustomerListSortBy,
  ICustomerRepository,
  SortOrder,
} from "../domain/ports/customer-repository.js";

export type ListCustomersRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy: CustomerListSortBy;
  sortOrder: SortOrder;
};

export type ListCustomersResult = {
  items: Customer[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListCustomersUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  async execute(input: ListCustomersRequest): Promise<ListCustomersResult> {
    void input.staffUserId;
    const page = await this.customers.list({
      organizationId: input.organizationId,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
    return {
      items: page.items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
