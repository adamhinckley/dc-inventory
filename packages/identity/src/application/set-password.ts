import {
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { ISetPasswordTokenStore } from "../domain/ports/set-password-token-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import {
  validatePassword,
  type PasswordPolicyViolation,
} from "../domain/password-policy.js";
import type { SetPasswordAudience } from "../domain/set-password-token.js";

export type SetPasswordRequest = {
  token: string;
  password: string;
  audience: SetPasswordAudience;
};

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "password_policy"; violation: PasswordPolicyViolation };

export class SetPasswordUseCase {
  constructor(
    private readonly tokens: ISetPasswordTokenStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly passwords: IPasswordHasher,
    private readonly clock: IClock,
  ) {}

  async execute(input: SetPasswordRequest): Promise<SetPasswordResult> {
    const policy = validatePassword(input.password);
    if (!policy.ok) {
      return { ok: false, reason: "password_policy", violation: policy.violation };
    }

    if (input.audience === "platform") {
      return { ok: false, reason: "invalid" };
    }

    const now = this.clock.now();
    const lookup = {
      rawToken: input.token,
      expectedAudience: input.audience,
      now,
    };
    const token = await this.tokens.findValid(lookup);
    if (token === null) {
      return { ok: false, reason: "invalid" };
    }

    if (input.audience === "staff") {
      const userId = StaffUserId.parse(token.userId);
      const user = await this.staffUsers.findById(userId);
      if (user === null) {
        return { ok: false, reason: "invalid" };
      }
      await this.staffUsers.save({
        ...user,
        passwordHash: await this.passwords.hash(input.password),
      });
      await this.tokens.consume(lookup);
      return { ok: true };
    }

    const userId = WholesaleUserId.parse(token.userId);
    const user = await this.wholesaleUsers.findById(userId);
    if (user === null) {
      return { ok: false, reason: "invalid" };
    }
    await this.wholesaleUsers.save({
      ...user,
      passwordHash: await this.passwords.hash(input.password),
    });
    await this.tokens.consume(lookup);
    return { ok: true };
  }
}
