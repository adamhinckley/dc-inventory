import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type {
  CustomerListPage,
  ICustomerRepository,
  ListCustomersQuery,
} from "../domain/ports/customer-repository.js";

export class InMemoryCustomerRepository implements ICustomerRepository {
  private readonly byId = new Map<CustomerId, Customer>();

  async list(query: ListCustomersQuery): Promise<CustomerListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((customer) => {
      if (customer.organizationId !== query.organizationId) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return customer.name.toLowerCase().includes(needle);
    });
    rows.sort((a, b) => {
      let cmp = 0;
      if (query.sortBy === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (query.sortBy === "creditLimitCents") {
        cmp = a.creditLimit.amountMinor - b.creditLimit.amountMinor;
      } else {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      }
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      total: rows.length,
    };
  }

  async findById(organizationId: OrganizationId, id: CustomerId): Promise<Customer | null> {
    const customer = this.byId.get(id);
    if (customer === undefined || customer.organizationId !== organizationId) {
      return null;
    }
    return customer;
  }

  async findByName(organizationId: OrganizationId, name: string): Promise<Customer | null> {
    const needle = name.trim();
    if (needle.length === 0) {
      return null;
    }
    for (const customer of this.byId.values()) {
      if (customer.organizationId === organizationId && customer.name === needle) {
        return customer;
      }
    }
    return null;
  }

  async save(customer: Customer): Promise<void> {
    const existing = this.byId.get(customer.id);
    this.byId.set(customer.id, {
      ...customer,
      createdAt: existing?.createdAt ?? customer.createdAt,
    });
  }
}
