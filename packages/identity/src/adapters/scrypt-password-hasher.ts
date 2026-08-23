import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";

function scryptAsync(
  plain: string,
  salt: Buffer,
  keyLen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, keyLen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

/** Argon2id-equivalent Phase 1 choice: Node scrypt. Use cases never import this. */
export class ScryptPasswordHasher implements IPasswordHasher {
  private dummyHashPromise: Promise<string> | undefined;

  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scryptAsync(plain, salt, KEY_LEN, { N, r: R, p: P });
    return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  }

  async verify(plain: string, passwordHash: string): Promise<boolean> {
    const parsed = parseScryptHash(passwordHash);
    if (parsed === null) {
      return false;
    }
    const key = await scryptAsync(plain, parsed.salt, parsed.keyLen, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });
    if (key.length !== parsed.hash.length) {
      return false;
    }
    return timingSafeEqual(key, parsed.hash);
  }

  async verifyDummy(plain: string): Promise<void> {
    this.dummyHashPromise ??= this.hash("identity-dummy-unknown-email");
    await this.verify(plain, await this.dummyHashPromise);
  }
}

type ParsedScrypt = {
  N: number;
  r: number;
  p: number;
  keyLen: number;
  salt: Buffer;
  hash: Buffer;
};

function parseScryptHash(value: string): ParsedScrypt | null {
  const parts = value.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }
  try {
    const salt = Buffer.from(parts[4] ?? "", "base64url");
    const hash = Buffer.from(parts[5] ?? "", "base64url");
    if (salt.length === 0 || hash.length === 0) {
      return null;
    }
    return { N, r, p, keyLen: hash.length, salt, hash };
  } catch {
    return null;
  }
}
