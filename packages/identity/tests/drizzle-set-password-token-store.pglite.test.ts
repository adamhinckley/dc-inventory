import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { DrizzleSetPasswordTokenStore } from "../src/adapters/drizzle-set-password-token-store.js";
import type { IdentityDrizzle } from "../src/adapters/drizzle-staff-user-repository.js";
import * as schema from "../src/persistence/schema.js";

const NOW = new Date("2026-09-12T12:00:00.000Z");
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

async function createHarness() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA identity;
    CREATE TYPE identity.set_password_audience AS ENUM ('staff', 'wholesale', 'platform');
    CREATE TABLE identity.set_password_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash text NOT NULL,
      audience identity.set_password_audience NOT NULL,
      user_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX set_password_tokens_token_hash_unique
      ON identity.set_password_tokens (token_hash);
    CREATE INDEX set_password_tokens_expires_at_idx
      ON identity.set_password_tokens (expires_at);
  `);
  const db = drizzle(client, { schema }) as unknown as IdentityDrizzle;
  const clock = new InMemoryClock(NOW);
  const store = new DrizzleSetPasswordTokenStore(db);
  return { client, store, clock };
}

describe("DrizzleSetPasswordTokenStore (PGlite)", () => {
  it("mints, finds, and consumes a valid staff token once", async () => {
    const { store, clock } = await createHarness();
    const expiresAt = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lookup = (rawToken: string) => ({
      rawToken,
      expectedAudience: "staff" as const,
      now: clock.now(),
    });

    const minted = await store.mint({
      audience: "staff",
      userId: USER_ID,
      expiresAt,
    });

    expect(minted.rawToken.length).toBeGreaterThan(20);
    expect(await store.findValid(lookup(minted.rawToken))).toEqual({
      userId: USER_ID,
      audience: "staff",
    });
    expect(await store.consume(lookup(minted.rawToken))).toBe(true);
    expect(await store.findValid(lookup(minted.rawToken))).toBeNull();
    expect(await store.consume(lookup(minted.rawToken))).toBe(false);
  });

  it("rejects expired, wrong-audience, and unknown tokens", async () => {
    const { store, clock } = await createHarness();
    const minted = await store.mint({
      audience: "staff",
      userId: USER_ID,
      expiresAt: new Date(NOW.getTime() - 1_000),
    });
    const lookup = (rawToken: string, expectedAudience: "staff" | "wholesale" = "staff") => ({
      rawToken,
      expectedAudience,
      now: clock.now(),
    });

    expect(await store.findValid(lookup(minted.rawToken))).toBeNull();
    expect(await store.consume(lookup(minted.rawToken))).toBe(false);

    const wholesale = await store.mint({
      audience: "wholesale",
      userId: USER_ID,
      expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    expect(await store.findValid(lookup(wholesale.rawToken, "staff"))).toBeNull();
    expect(await store.consume(lookup(wholesale.rawToken, "staff"))).toBe(false);

    expect(await store.findValid(lookup("unknown-token"))).toBeNull();
    expect(await store.consume(lookup("unknown-token"))).toBe(false);
  });
});
