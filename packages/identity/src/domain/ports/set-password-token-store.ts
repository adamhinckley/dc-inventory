import type { SetPasswordAudience } from "../set-password-token.js";

export type MintSetPasswordTokenInput = {
  audience: SetPasswordAudience;
  userId: string;
  expiresAt: Date;
};

export type MintedSetPasswordToken = {
  rawToken: string;
};

export type ClaimSetPasswordTokenInput = {
  rawToken: string;
  expectedAudience: SetPasswordAudience;
  now: Date;
};

export type ClaimedSetPasswordToken = {
  userId: string;
  audience: SetPasswordAudience;
};

export interface ISetPasswordTokenStore {
  mint(input: MintSetPasswordTokenInput): Promise<MintedSetPasswordToken>;
  claim(input: ClaimSetPasswordTokenInput): Promise<ClaimedSetPasswordToken | null>;
}
