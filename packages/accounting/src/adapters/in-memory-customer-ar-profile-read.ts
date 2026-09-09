import type { ICustomerRepository } from "@dc-inventory/customers";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  CustomerArProfile,
  ICustomerArProfileReadPort,
} from "../domain/ports/customer-ar-profile-read.js";

function toProfile(customer: {
  id: CustomerId;
  customerNumber: string;
  name: string;
  creditLimit: { amountMinor: number; currency: string };
}): CustomerArProfile {
  return {
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    creditLimitCents: customer.creditLimit.amountMinor,
    currency: customer.creditLimit.currency,
  };
}

export class InMemoryCustomerArProfileReadPort implements ICustomerArProfileReadPort {
  constructor(private readonly customers: ICustomerRepository) {}

  async findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArProfile | null> {
    const customer = await this.customers.findById(organizationId, customerId);
    return customer === null ? null : toProfile(customer);
  }

  async listAll(organizationId: OrganizationId): Promise<readonly CustomerArProfile[]> {
    const items: CustomerArProfile[] = [];
    const pageSize = 500;
    let page = 1;
    let total = 0;
    do {
      const result = await this.customers.list({
        organizationId,
        page,
        pageSize,
        sortBy: "name",
        sortOrder: "asc",
      });
      items.push(...result.items.map(toProfile));
      total = result.total;
      page += 1;
    } while (items.length < total);
    return items;
  }
}
