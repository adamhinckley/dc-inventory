import { OrganizationId, type StaffUserId, type SessionId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffRole } from "../domain/staff-role.js";
import { resolveLoginOrganizationId } from "./resolve-login-organization.js";

export type LoginStaffRequest = {
  organizationSlug: string;
  email: string;
  password: string;
};

export type LoginStaffResult =
  | {
      ok: true;
      sessionId: SessionId;
      staffUserId: StaffUserId;
      email: string;
      organizationId: OrganizationId;
      roles: readonly StaffRole[];
    }
  | { ok: false };

export class LoginStaffUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
  ) {}

  async execute(input: LoginStaffRequest): Promise<LoginStaffResult> {
    const organizationId = await resolveLoginOrganizationId(
      this.organizations,
      input.organizationSlug,
    );
    if (organizationId === null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const email = normalizeEmail(input.email);
    const user = await this.staffUsers.findByEmail(organizationId, email);
    if (user === null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const matches = await this.passwords.verify(input.password, user.passwordHash);
    if (!matches) {
      return { ok: false };
    }
    const now = this.clock.now();
    const session = await this.sessions.create({
      audience: "staff",
      organizationId: user.organizationId,
      staffUserId: user.id,
      platformUserId: null,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      staffUserId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles,
    };
  }
}
