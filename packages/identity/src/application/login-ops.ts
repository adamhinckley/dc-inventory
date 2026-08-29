import {
  OrganizationId,
  type SessionId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { OpsActorKind, OpsUserId } from "../domain/ops-user.js";
import type { IOpsUserRepository } from "../domain/ports/ops-user-repository.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import { resolveLoginOrganizationId } from "./resolve-login-organization.js";

export type LoginOpsRequest = {
  organizationSlug: string;
  email: string;
  password: string;
};

export type LoginOpsResult =
  | {
      ok: true;
      sessionId: SessionId;
      opsUserId: OpsUserId;
      email: string;
      kind: OpsActorKind;
      tenantId: OrganizationId;
    }
  | { ok: false };

export class LoginOpsUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly opsUsers: IOpsUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
  ) {}

  async execute(input: LoginOpsRequest): Promise<LoginOpsResult> {
    const tenantId = await resolveLoginOrganizationId(
      this.organizations,
      input.organizationSlug,
    );
    if (tenantId === null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const email = normalizeEmail(input.email);
    const user = await this.opsUsers.findByEmail(tenantId, email);
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
      audience: "ops",
      organizationId: user.tenantId,
      staffUserId: null,
      wholesaleUserId: null,
      opsUserId: user.id,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      opsUserId: user.id,
      email: user.email,
      kind: user.kind,
      tenantId: user.tenantId,
    };
  }
}
