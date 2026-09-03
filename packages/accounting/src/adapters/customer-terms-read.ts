import type { ICustomerRepository } from "@dc-inventory/customers";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ICustomerTermsReadPort } from "../domain/ports/customer-terms-read.js";

export class CustomerTermsReadAdapter implements ICustomerTermsReadPort {
  constructor(private readonly customers: ICustomerRepository) {}

  async getTerms(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<string | null> {
    const customer = await this.customers.findById(organizationId, customerId);
    return customer?.terms ?? null;
  }
}
