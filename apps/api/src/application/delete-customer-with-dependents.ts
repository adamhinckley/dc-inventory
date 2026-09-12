import type { DeleteCustomerUseCase, ICustomerRepository } from "@dc-inventory/customers";
import type {
  ISessionStore,
  ISetPasswordTokenStore,
  IWholesaleUserRepository,
} from "@dc-inventory/identity";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ICustomerOccupancyReadPort } from "../adapters/customer-occupancy-read-port.js";

export type DeleteCustomerWithDependentsResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "customer_not_empty" };

export class DeleteCustomerWithDependentsUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly occupancy: ICustomerOccupancyReadPort,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly sessions: ISessionStore,
    private readonly setPasswordTokens: ISetPasswordTokenStore,
    private readonly deleteCustomer: DeleteCustomerUseCase,
  ) {}

  async execute(input: {
    organizationId: OrganizationId;
    customerId: CustomerId;
  }): Promise<DeleteCustomerWithDependentsResult> {
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }

    if (await this.occupancy.hasOccupancy(input.organizationId, input.customerId)) {
      return { ok: false, reason: "customer_not_empty" };
    }

    const users = await this.wholesaleUsers.listByCustomerId(
      input.organizationId,
      input.customerId,
    );
    for (const user of users) {
      await this.setPasswordTokens.deleteByUserId(user.id);
      await this.sessions.deleteByWholesaleUserId(user.id);
    }
    await this.sessions.deleteByCustomerId(input.customerId);
    for (const user of users) {
      await this.wholesaleUsers.deleteById(user.id);
    }

    return this.deleteCustomer.execute(input);
  }
}
