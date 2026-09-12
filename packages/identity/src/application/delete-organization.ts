import { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";

export type DeleteOrganizationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "default_organization" };

export class DeleteOrganizationUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly sessions: ISessionStore,
  ) {}

  async execute(organizationId: OrganizationId): Promise<DeleteOrganizationResult> {
    if (organizationId === OrganizationId.DEFAULT) {
      return { ok: false, reason: "default_organization" };
    }

    const organization = await this.organizations.findById(organizationId);
    if (organization === null) {
      return { ok: false, reason: "not_found" };
    }

    const staff = await this.staffUsers.listByOrganizationId(organizationId);
    for (const user of staff) {
      await this.sessions.deleteByStaffUserId(user.id);
      await this.staffUsers.deleteById(user.id);
    }

    await this.organizations.deleteById(organizationId);
    return { ok: true };
  }
}
