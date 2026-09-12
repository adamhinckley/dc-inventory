import { PlatformUserId, type SessionId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { IPlatformUserRepository } from "../domain/ports/platform-user-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { ISessionStore } from "../domain/ports/session-store.js";

export type LoginPlatformRequest = {
  email: string;
  password: string;
};

export type LoginPlatformResult =
  | {
      ok: true;
      sessionId: SessionId;
      platformUserId: PlatformUserId;
      email: string;
    }
  | { ok: false };

export class LoginPlatformUseCase {
  constructor(
    private readonly platformUsers: IPlatformUserRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
  ) {}

  async execute(input: LoginPlatformRequest): Promise<LoginPlatformResult> {
    const email = normalizeEmail(input.email);
    if (await this.staffUsers.findByEmailGlobally(email) !== null) {
      await this.passwords.verifyDummy(input.password);
      return { ok: false };
    }
    const user = await this.platformUsers.findByEmail(email);
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
      audience: "platform",
      organizationId: null,
      staffUserId: null,
      platformUserId: user.id,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      platformUserId: user.id,
      email: user.email,
    };
  }
}
