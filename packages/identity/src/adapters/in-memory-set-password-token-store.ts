import type {
  ISetPasswordTokenStore,
  MintedSetPasswordToken,
  MintSetPasswordTokenInput,
  SetPasswordTokenLookupInput,
  ValidSetPasswordToken,
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

  async findValid(input: SetPasswordTokenLookupInput): Promise<ValidSetPasswordToken | null> {
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
    return { userId: stored.userId, audience: stored.audience };
  }

  async consume(input: SetPasswordTokenLookupInput): Promise<boolean> {
    const stored = this.byHash.get(hashSetPasswordToken(input.rawToken));
    if (stored === undefined) {
      return false;
    }
    if (
      stored.consumedAt !== null ||
      stored.expiresAt.getTime() <= input.now.getTime() ||
      stored.audience !== input.expectedAudience
    ) {
      return false;
    }
    stored.consumedAt = input.now;
    return true;
  }
}
