import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type {
  ISetPasswordTokenStore,
  MintedSetPasswordToken,
  MintSetPasswordTokenInput,
  SetPasswordTokenLookupInput,
  ValidSetPasswordToken,
} from "../domain/ports/set-password-token-store.js";
import type { SetPasswordAudience } from "../domain/set-password-token.js";
import { setPasswordTokens } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";
import { hashSetPasswordToken } from "./set-password-token-hash.js";

export class DrizzleSetPasswordTokenStore implements ISetPasswordTokenStore {
  constructor(private readonly db: IdentityDrizzle) {}

  async mint(input: MintSetPasswordTokenInput): Promise<MintedSetPasswordToken> {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashSetPasswordToken(rawToken);
    const now = new Date();
    await this.db.insert(setPasswordTokens).values({
      tokenHash,
      audience: input.audience,
      userId: input.userId,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return { rawToken };
  }

  async findValid(input: SetPasswordTokenLookupInput): Promise<ValidSetPasswordToken | null> {
    const tokenHash = hashSetPasswordToken(input.rawToken);
    const rows = await this.db
      .select({
        userId: setPasswordTokens.userId,
        audience: setPasswordTokens.audience,
      })
      .from(setPasswordTokens)
      .where(
        and(
          eq(setPasswordTokens.tokenHash, tokenHash),
          eq(setPasswordTokens.audience, input.expectedAudience),
          isNull(setPasswordTokens.consumedAt),
          gt(setPasswordTokens.expiresAt, input.now),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      userId: row.userId,
      audience: row.audience as SetPasswordAudience,
    };
  }

  async consume(input: SetPasswordTokenLookupInput): Promise<boolean> {
    const tokenHash = hashSetPasswordToken(input.rawToken);
    const rows = await this.db
      .update(setPasswordTokens)
      .set({ consumedAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(setPasswordTokens.tokenHash, tokenHash),
          eq(setPasswordTokens.audience, input.expectedAudience),
          isNull(setPasswordTokens.consumedAt),
          gt(setPasswordTokens.expiresAt, input.now),
        ),
      )
      .returning({ id: setPasswordTokens.id });
    return rows[0] !== undefined;
  }
}
