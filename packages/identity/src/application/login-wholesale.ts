import {
  OrganizationId,
  type CustomerId,
  type SessionId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { IWholesaleLoginAccountStatusReadPort } from "../domain/ports/wholesale-login-account-status-read.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { StaffRole } from "../domain/staff-role.js";
import { resolveLoginOrganizationId } from "./resolve-login-organization.js";

const WHOLESALE_ACTING_STAFF_ROLES = new Set<StaffRole>(["admin", "sales_support"]);

export type LoginWholesaleRequest = {
  organizationSlug: string;
  email: string;
  password: string;
};

export type LoginWholesaleResult =
  | {
      ok: true;
      sessionId: SessionId;
      mode: "buyer";
      wholesaleUserId: WholesaleUserId;
      staffUserId: null;
      email: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
    }
  | {
      ok: true;
      sessionId: SessionId;
      mode: "staff_acting";
      staffUserId: StaffUserId;
      wholesaleUserId: null;
      customerId: null;
      email: string;
      organizationId: OrganizationId;
    }
  | { ok: false };

function canActOnWholesale(roles: readonly StaffRole[]): boolean {
  return roles.some((role) => WHOLESALE_ACTING_STAFF_ROLES.has(role));
}

export class LoginWholesaleUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
    private readonly accountStatus: IWholesaleLoginAccountStatusReadPort,
  ) {}

  async execute(input: LoginWholesaleRequest): Promise<LoginWholesaleResult> {
    const organizationId = await resolveLoginOrganizationId(
      this.organizations,
      input.organizationSlug,
    );
    if (organizationId === null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const email = normalizeEmail(input.email);
    const wholesaleUser = await this.wholesaleUsers.findByEmail(organizationId, email);
    if (wholesaleUser !== null) {
      return this.loginBuyer(wholesaleUser, input.password);
    }
    const staffUser = await this.staffUsers.findByEmail(organizationId, email);
    if (staffUser === null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const matches = await this.passwords.verify(input.password, staffUser.passwordHash);
    if (!matches || !canActOnWholesale(staffUser.roles)) {
      return { ok: false };
    }
    const now = this.clock.now();
    const session = await this.sessions.create({
      audience: "wholesale",
      organizationId: staffUser.organizationId,
      staffUserId: staffUser.id,
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
      mode: "staff_acting",
      staffUserId: staffUser.id,
      wholesaleUserId: null,
      customerId: null,
      email: staffUser.email,
      organizationId: staffUser.organizationId,
    };
  }

  private async loginBuyer(
    user: {
      id: WholesaleUserId;
      email: string;
      passwordHash: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
    },
    password: string,
  ): Promise<LoginWholesaleResult> {
    const matches = await this.passwords.verify(password, user.passwordHash);
    if (!matches) {
      return { ok: false };
    }
    const accountStatus = await this.accountStatus.getAccountStatus(
      user.organizationId,
      user.customerId,
    );
    if (accountStatus !== "active" && accountStatus !== "on_hold") {
      return { ok: false };
    }
    const now = this.clock.now();
    const session = await this.sessions.create({
      audience: "wholesale",
      organizationId: user.organizationId,
      staffUserId: null,
      platformUserId: null,
      wholesaleUserId: user.id,
      opsUserId: null,
      customerId: user.customerId,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      mode: "buyer",
      wholesaleUserId: user.id,
      staffUserId: null,
      email: user.email,
      customerId: user.customerId,
      organizationId: user.organizationId,
    };
  }
}
