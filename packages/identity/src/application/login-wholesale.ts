import {
  OrganizationId,
  type CustomerId,
  type SessionId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import { resolveLoginOrganizationId } from "./resolve-login-organization.js";

export type LoginWholesaleRequest = {
  organizationSlug: string;
  email: string;
  password: string;
};

export type LoginWholesaleResult =
  | {
      ok: true;
      sessionId: SessionId;
      wholesaleUserId: WholesaleUserId;
      email: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
    }
  | { ok: false };

export class LoginWholesaleUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
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
    const user = await this.wholesaleUsers.findByEmail(organizationId, email);
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
      audience: "wholesale",
      organizationId: user.organizationId,
      staffUserId: null,
      wholesaleUserId: user.id,
      opsUserId: null,
      customerId: user.customerId,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      wholesaleUserId: user.id,
      email: user.email,
      customerId: user.customerId,
      organizationId: user.organizationId,
    };
  }
}
