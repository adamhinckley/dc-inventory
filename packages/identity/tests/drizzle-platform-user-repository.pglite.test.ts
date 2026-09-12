import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { DrizzlePlatformUserRepository } from "../src/adapters/drizzle-platform-user-repository.js";
import type { IdentityDrizzle } from "../src/adapters/drizzle-staff-user-repository.js";
import * as schema from "../src/persistence/schema.js";
import { PlatformUserId } from "@dc-inventory/shared-kernel";

const PLATFORM_ID = PlatformUserId.parse("550e8400-e29b-41d4-a716-446655440001");

async function createHarness() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA identity;
    CREATE TYPE identity.actor_type AS ENUM ('staff', 'wholesale', 'ops', 'platform');
    CREATE TABLE identity.platform_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX platform_users_email_unique ON identity.platform_users (email);
  `);
  const db = drizzle(client, { schema }) as unknown as IdentityDrizzle;
  const repo = new DrizzlePlatformUserRepository(db);
  return { repo };
}

describe("DrizzlePlatformUserRepository (PGlite)", () => {
  it("saves and finds platform users by email", async () => {
    const { repo } = await createHarness();
    await repo.save({
      id: PLATFORM_ID,
      displayName: "Adam Platform",
      email: "adam@local.test",
      passwordHash: "hash",
    });

    expect(await repo.findByEmail("adam@local.test")).toMatchObject({
      id: PLATFORM_ID,
      email: "adam@local.test",
    });
    expect(await repo.findById(PLATFORM_ID)).toMatchObject({
      displayName: "Adam Platform",
    });
  });
});
