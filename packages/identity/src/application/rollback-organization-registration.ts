import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";

export type RollbackOrganizationRegistrationRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
};

export class RollbackOrganizationRegistrationUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly staffUsers: IStaffUserRepository,
  ) {}

  async execute(input: RollbackOrganizationRegistrationRequest): Promise<void> {
    await this.staffUsers.deleteById(input.staffUserId);
    await this.organizations.deleteById(input.organizationId);
  }
}
