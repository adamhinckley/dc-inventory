import { type StaffUserId, type SessionId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { normalizeEmail } from "../domain/email.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";

export type LoginStaffRequest = {
  email: string;
  password: string;
};

export type LoginStaffResult =
  | {
      ok: true;
      sessionId: SessionId;
      staffUserId: StaffUserId;
      email: string;
    }
  | { ok: false };

export class LoginStaffUseCase {
  constructor(
    private readonly staffUsers: IStaffUserRepository,
    private readonly sessions: ISessionStore,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
  ) {}

  async execute(input: LoginStaffRequest): Promise<LoginStaffResult> {
    const email = normalizeEmail(input.email);
    const user = await this.staffUsers.findByEmail(email);
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
      staffUserId: user.id,
      wholesaleUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });
    return {
      ok: true,
      sessionId: session.id,
      staffUserId: user.id,
      email: user.email,
    };
  }
}
