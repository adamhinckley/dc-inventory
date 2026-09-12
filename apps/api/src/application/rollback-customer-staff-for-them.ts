import type { ICustomerRepository } from "@dc-inventory/customers";
import type { ISetPasswordTokenStore, IWholesaleUserRepository } from "@dc-inventory/identity";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type RollbackCustomerStaffForThemRequest = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  wholesaleEmail?: string;
};

export class RollbackCustomerStaffForThemUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly setPasswordTokens: ISetPasswordTokenStore,
  ) {}

  async execute(input: RollbackCustomerStaffForThemRequest): Promise<void> {
    if (input.wholesaleEmail !== undefined) {
      const wholesaleUser = await this.wholesaleUsers.findByEmail(
        input.organizationId,
        input.wholesaleEmail,
      );
      if (
        wholesaleUser !== null &&
        wholesaleUser.customerId === input.customerId
      ) {
        await this.setPasswordTokens.deleteByUserId(wholesaleUser.id);
        await this.wholesaleUsers.deleteById(wholesaleUser.id);
      }
    }
    await this.customers.deleteById(input.organizationId, input.customerId);
  }
}
