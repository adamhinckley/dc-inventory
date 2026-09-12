import type { SetPasswordAudience } from "../set-password-token.js";

export type MintSetPasswordTokenInput = {
  audience: SetPasswordAudience;
  userId: string;
  expiresAt: Date;
};

export type MintedSetPasswordToken = {
  rawToken: string;
};

export type SetPasswordTokenLookupInput = {
  rawToken: string;
  expectedAudience: SetPasswordAudience;
  now: Date;
};

export type ValidSetPasswordToken = {
  userId: string;
  audience: SetPasswordAudience;
};

export interface ISetPasswordTokenStore {
  mint(input: MintSetPasswordTokenInput): Promise<MintedSetPasswordToken>;
  findValid(input: SetPasswordTokenLookupInput): Promise<ValidSetPasswordToken | null>;
  consume(input: SetPasswordTokenLookupInput): Promise<boolean>;
  deleteByUserId(userId: string): Promise<void>;
}
