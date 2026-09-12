import type {
  ClaimedSetPasswordToken,
  ClaimSetPasswordTokenInput,
  ISetPasswordTokenStore,
  MintedSetPasswordToken,
  MintSetPasswordTokenInput,
} from "../domain/ports/set-password-token-store.js";
import { hashSetPasswordToken } from "./set-password-token-hash.js";

type StoredToken = {
  audience: MintSetPasswordTokenInput["audience"];
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export class InMemorySetPasswordTokenStore implements ISetPasswordTokenStore {
  private readonly byHash = new Map<string, StoredToken>();

  async mint(input: MintSetPasswordTokenInput): Promise<MintedSetPasswordToken> {
    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    this.byHash.set(hashSetPasswordToken(rawToken), {
      audience: input.audience,
      userId: input.userId,
      expiresAt: input.expiresAt,
      consumedAt: null,
    });
    return { rawToken };
  }

  async claim(input: ClaimSetPasswordTokenInput): Promise<ClaimedSetPasswordToken | null> {
    const stored = this.byHash.get(hashSetPasswordToken(input.rawToken));
    if (stored === undefined) {
      return null;
    }
    if (
      stored.consumedAt !== null ||
      stored.expiresAt.getTime() <= input.now.getTime() ||
      stored.audience !== input.expectedAudience
    ) {
      return null;
    }
    stored.consumedAt = input.now;
    return { userId: stored.userId, audience: stored.audience };
  }
}
