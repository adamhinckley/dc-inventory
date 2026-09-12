import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import {
  CustomerId,
  OrganizationId,
  PlatformUserId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { DrizzlePlatformUserRepository } from "../src/adapters/drizzle-platform-user-repository.js";
import { DrizzleSessionStore } from "../src/adapters/drizzle-session-store.js";
import type { IdentityDrizzle } from "../src/adapters/drizzle-staff-user-repository.js";
import { ResolvePlatformSessionUseCase } from "../src/application/resolve-session.js";
import * as schema from "../src/persistence/schema.js";

const PLATFORM_ID = PlatformUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const SESSION_ID = SessionId.parse("550e8400-e29b-41d4-a716-446655440012");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440020");
const WHOLESALE_USER_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440021");
const STAFF_ACTING_SESSION_ID = SessionId.parse("550e8400-e29b-41d4-a716-446655440022");
const BUYER_SESSION_ID = SessionId.parse("550e8400-e29b-41d4-a716-446655440023");

async function createHarness() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA identity;
    CREATE TYPE identity.actor_type AS ENUM ('staff', 'wholesale', 'ops', 'platform');
    CREATE TABLE identity.platform_users (
      id uuid PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE identity.staff_users (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      roles text[] NOT NULL DEFAULT ARRAY['admin'],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE identity.sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type identity.actor_type NOT NULL,
      actor_id uuid NOT NULL,
      staff_user_id uuid,
      platform_user_id uuid REFERENCES identity.platform_users(id),
      organization_id text,
      customer_id uuid,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO identity.platform_users (id, display_name, email, password_hash)
    VALUES ('${PLATFORM_ID}', 'Adam Platform', 'adam@local.test', 'hash');
    INSERT INTO identity.staff_users (id, organization_id, display_name, email, password_hash, roles)
    VALUES ('${STAFF_ID}', '${OrganizationId.DEFAULT}', 'David Staff', 'staff@local.test', 'hash', ARRAY['admin']);
  `);
  const db = drizzle(client, { schema }) as unknown as IdentityDrizzle;
  const sessions = new DrizzleSessionStore(db);
  const platformUsers = new DrizzlePlatformUserRepository(db);
  const clock = new InMemoryClock(new Date("2026-09-12T12:00:00.000Z"));
  return { client, sessions, platformUsers, clock };
}

describe("DrizzleSessionStore platform sessions (PGlite)", () => {
  it("findPlatformResolved returns email and rejects non-null organizationId", async () => {
    const { client, sessions, platformUsers, clock } = await createHarness();
    const now = clock.now();
    const valid = await sessions.create({
      audience: "platform",
      organizationId: null,
      staffUserId: null,
      platformUserId: PLATFORM_ID,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });

    expect(await sessions.findPlatformResolved!(valid.id)).toEqual({
      session: expect.objectContaining({
        audience: "platform",
        organizationId: null,
        platformUserId: PLATFORM_ID,
      }),
      email: "adam@local.test",
      displayName: "Adam Platform",
    });

    clock.advance(1);
    await client.exec(`
      INSERT INTO identity.sessions (
        id, actor_type, actor_id, platform_user_id, organization_id, last_seen_at, created_at, updated_at
      ) VALUES (
        '${SessionId.parse("550e8400-e29b-41d4-a716-446655440099")}',
        'platform',
        '${PLATFORM_ID}',
        '${PLATFORM_ID}',
        '${OrganizationId.DEFAULT}',
        '${clock.now().toISOString()}',
        '${clock.now().toISOString()}',
        '${clock.now().toISOString()}'
      )
    `);
    expect(
      await sessions.findPlatformResolved!(
        SessionId.parse("550e8400-e29b-41d4-a716-446655440099"),
      ),
    ).toBeNull();

    const resolveUseCase = new ResolvePlatformSessionUseCase(sessions, platformUsers, clock);
    expect(await resolveUseCase.execute(valid.id)).toEqual({
      ok: true,
      platformUserId: PLATFORM_ID,
      email: "adam@local.test",
      displayName: "Adam Platform",
    });
  });

  it("persists platform sessions with nullable organization_id", async () => {
    const { client, sessions } = await createHarness();
    const now = new Date("2026-09-12T12:00:00.000Z");
    await client.exec(`
      INSERT INTO identity.sessions (
        id, actor_type, actor_id, platform_user_id, organization_id, last_seen_at, created_at, updated_at
      ) VALUES (
        '${SESSION_ID}', 'platform', '${PLATFORM_ID}', '${PLATFORM_ID}', NULL, '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'
      )
    `);

    const loaded = await sessions.findById(SESSION_ID);
    expect(loaded?.organizationId).toBeNull();
    expect(loaded?.audience).toBe("platform");
  });
});

describe("DrizzleSessionStore deleteByCustomerId (PGlite)", () => {
  it("clears staff acting customerId and deletes buyer sessions", async () => {
    const { client, sessions } = await createHarness();
    const now = new Date("2026-09-12T12:00:00.000Z").toISOString();
    await client.exec(`
      INSERT INTO identity.sessions (
        id, actor_type, actor_id, staff_user_id, organization_id, customer_id, last_seen_at, created_at, updated_at
      ) VALUES
        (
          '${STAFF_ACTING_SESSION_ID}', 'wholesale', '${STAFF_ID}', '${STAFF_ID}',
          '${OrganizationId.DEFAULT}', '${CUSTOMER_ID}', '${now}', '${now}', '${now}'
        ),
        (
          '${BUYER_SESSION_ID}', 'wholesale', '${WHOLESALE_USER_ID}', NULL,
          '${OrganizationId.DEFAULT}', '${CUSTOMER_ID}', '${now}', '${now}', '${now}'
        );
    `);

    await sessions.deleteByCustomerId(CUSTOMER_ID);

    const staffActing = await sessions.findById(STAFF_ACTING_SESSION_ID);
    expect(staffActing).toEqual(
      expect.objectContaining({
        audience: "wholesale",
        staffUserId: STAFF_ID,
        wholesaleUserId: null,
        customerId: null,
      }),
    );
    expect(await sessions.findById(BUYER_SESSION_ID)).toBeNull();
  });
});
