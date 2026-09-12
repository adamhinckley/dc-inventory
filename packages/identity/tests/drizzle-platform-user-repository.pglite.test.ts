import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { DrizzlePlatformUserRepository } from "../src/adapters/drizzle-platform-user-repository.js";
import { DrizzleStaffUserRepository } from "../src/adapters/drizzle-staff-user-repository.js";
import type { IdentityDrizzle } from "../src/adapters/drizzle-staff-user-repository.js";
import * as schema from "../src/persistence/schema.js";
import { OrganizationId, PlatformUserId, StaffUserId } from "@dc-inventory/shared-kernel";
import { testStaffUser } from "./support/fixtures.js";

const PLATFORM_ID = PlatformUserId.parse("550e8400-e29b-41d4-a716-446655440001");
const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440002");

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
    CREATE TABLE identity.staff_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id text NOT NULL,
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      roles text[] NOT NULL DEFAULT ARRAY['admin'],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const db = drizzle(client, { schema }) as unknown as IdentityDrizzle;
  const platformRepo = new DrizzlePlatformUserRepository(db);
  const staffRepo = new DrizzleStaffUserRepository(db);
  return { platformRepo, staffRepo };
}

describe("DrizzlePlatformUserRepository (PGlite)", () => {
  it("saves and finds platform users by email", async () => {
    const { platformRepo } = await createHarness();
    await platformRepo.save({
      id: PLATFORM_ID,
      displayName: "Adam Platform",
      email: "adam@local.test",
      passwordHash: "hash",
    });

    expect(await platformRepo.findByEmail("adam@local.test")).toMatchObject({
      id: PLATFORM_ID,
      email: "adam@local.test",
    });
    expect(await platformRepo.findById(PLATFORM_ID)).toMatchObject({
      displayName: "Adam Platform",
    });
  });

  it("rejects platform save when staff already owns the email", async () => {
    const { platformRepo, staffRepo } = await createHarness();
    await staffRepo.save(
      testStaffUser({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "shared@local.test",
        passwordHash: "hash",
        roles: ["admin"],
      }),
    );

    await expect(
      platformRepo.save({
        id: PLATFORM_ID,
        displayName: "Shared Email",
        email: "shared@local.test",
        passwordHash: "hash",
      }),
    ).rejects.toThrow(/staff user/i);
  });
});
