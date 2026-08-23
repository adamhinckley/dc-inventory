import type { IPasswordHasher } from "../domain/ports/password-hasher.js";

const PREFIX = "plain:";
const DUMMY_HASH = `${PREFIX}__unknown__`;

/** Test hasher — no scrypt, no network. */
export class InMemoryPasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `${PREFIX}${plain}`;
  }

  async verify(plain: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `${PREFIX}${plain}`;
  }

  async verifyDummy(plain: string): Promise<void> {
    await this.verify(plain, DUMMY_HASH);
  }
}
