import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import type {
  CustomerListPage,
  ICustomerRepository,
  ListCustomersQuery,
} from "../domain/ports/customer-repository.js";

type Stored = { customer: Customer; createdAt: Date };

export class InMemoryCustomerRepository implements ICustomerRepository {
  private readonly byId = new Map<CustomerId, Stored>();

  async list(query: ListCustomersQuery): Promise<CustomerListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((row) => {
      if (needle.length === 0) {
        return true;
      }
      return row.customer.name.toLowerCase().includes(needle);
    });
    rows.sort((a, b) => {
      let cmp = 0;
      if (query.sortBy === "name") {
        cmp = a.customer.name.localeCompare(b.customer.name);
      } else if (query.sortBy === "creditLimitCents") {
        cmp = a.customer.creditLimit.amountMinor - b.customer.creditLimit.amountMinor;
      } else {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      }
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize).map((row) => row.customer),
      total: rows.length,
    };
  }

  async findById(id: CustomerId): Promise<Customer | null> {
    return this.byId.get(id)?.customer ?? null;
  }

  async findByName(name: string): Promise<Customer | null> {
    const needle = name.trim();
    if (needle.length === 0) {
      return null;
    }
    for (const row of this.byId.values()) {
      if (row.customer.name === needle) {
        return row.customer;
      }
    }
    return null;
  }

  async save(customer: Customer): Promise<void> {
    const existing = this.byId.get(customer.id);
    this.byId.set(customer.id, {
      customer,
      createdAt: existing?.createdAt ?? new Date(),
    });
  }
}
