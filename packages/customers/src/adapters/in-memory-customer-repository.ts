import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Customer } from "../domain/customer.js";
import { formatCustomerNumber, parseCustomerNumberSequence } from "../domain/document-number.js";
import type {
  CustomerListPage,
  ICustomerRepository,
  ListCustomersQuery,
} from "../domain/ports/customer-repository.js";

export class InMemoryCustomerRepository implements ICustomerRepository {
  private readonly byId = new Map<CustomerId, Customer>();
  private readonly nextSequenceByOrg = new Map<OrganizationId, number>();

  async list(query: ListCustomersQuery): Promise<CustomerListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((customer) => {
      if (customer.organizationId !== query.organizationId) {
        return false;
      }
      if (query.accountStatus !== undefined && customer.accountStatus !== query.accountStatus) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return (
        customer.name.toLowerCase().includes(needle) ||
        customer.customerNumber.toLowerCase().includes(needle)
      );
    });
    rows.sort((a, b) => {
      let cmp = 0;
      if (query.sortBy === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (query.sortBy === "customerNumber") {
        cmp = a.customerNumber.localeCompare(b.customerNumber);
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

  async findByCustomerNumber(
    organizationId: OrganizationId,
    customerNumber: string,
  ): Promise<Customer | null> {
    const needle = customerNumber.trim();
    if (needle.length === 0) {
      return null;
    }
    for (const customer of this.byId.values()) {
      if (
        customer.organizationId === organizationId &&
        customer.customerNumber === needle
      ) {
        return customer;
      }
    }
    return null;
  }

  async allocateNextCustomerNumber(organizationId: OrganizationId): Promise<string> {
    const next = this.nextSequenceByOrg.get(organizationId) ?? 1;
    this.nextSequenceByOrg.set(organizationId, next + 1);
    return formatCustomerNumber(next);
  }

  async save(customer: Customer): Promise<void> {
    const customerNumber =
      customer.customerNumber !== undefined && customer.customerNumber.trim().length > 0
        ? customer.customerNumber
        : await this.allocateNextCustomerNumber(customer.organizationId);
    const existing = this.byId.get(customer.id);
    const normalized: Customer = {
      ...customer,
      customerNumber,
      accountStatus: customer.accountStatus ?? "active",
      taxId: customer.taxId ?? null,
      customerNote: customer.customerNote ?? null,
      staffNote: customer.staffNote ?? null,
      createdAt: existing?.createdAt ?? customer.createdAt,
    };
    this.byId.set(customer.id, normalized);
    const sequence = parseCustomerNumberSequence(normalized.customerNumber);
    if (sequence !== null) {
      const current = this.nextSequenceByOrg.get(normalized.organizationId) ?? 1;
      if (sequence >= current) {
        this.nextSequenceByOrg.set(normalized.organizationId, sequence + 1);
      }
    }
  }
}
