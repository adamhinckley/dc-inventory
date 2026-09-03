import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { AccountStatus } from "../domain/account-status.js";
import type { ICustomerAccountStatusReadPort } from "../domain/ports/customer-account-status-read.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export class CustomerAccountStatusReadAdapter implements ICustomerAccountStatusReadPort {
  constructor(private readonly customers: ICustomerRepository) {}

  async getAccountStatus(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<AccountStatus | null> {
    const customer = await this.customers.findById(organizationId, customerId);
    if (customer === null) {
      return null;
    }
    return customer.accountStatus;
  }
}
