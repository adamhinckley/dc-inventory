export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, passwordHash: string): Promise<boolean>;
  /** Constant-time-ish work when the email is unknown. */
  verifyDummy(plain: string): Promise<void>;
}
