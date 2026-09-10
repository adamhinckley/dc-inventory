import { OrganizationId, SessionId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzleSessionStore } from "../src/adapters/drizzle-session-store.js";

class CapturingIdentityDb {
  readonly selects: unknown[] = [];

  select(selection: unknown) {
    this.selects.push(selection);
    return {
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
        innerJoin: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
  }

  insert() {
    return {
      values: () => ({
        returning: async () => [],
      }),
    };
  }

  update() {
    return {
      set: () => ({
        where: async () => undefined,
      }),
    };
  }

  delete() {
    return {
      where: async () => undefined,
    };
  }
}

describe("DrizzleSessionStore", () => {
  it("loads wholesale sessions with one left-join query", async () => {
    const db = new CapturingIdentityDb();
    const store = new DrizzleSessionStore(db as never);
    const sessionId = SessionId.parse("550e8400-e29b-41d4-a716-446655440010");

    await store.findWholesaleResolved(sessionId);

    expect(db.selects).toHaveLength(1);
    expect(db.selects[0]).toMatchObject({
      staffEmail: expect.anything(),
      wholesaleEmail: expect.anything(),
    });
  });

  it("inner-joins staff sessions to staff_users", async () => {
    const db = new CapturingIdentityDb();
    const store = new DrizzleSessionStore(db as never);
    const sessionId = SessionId.parse("550e8400-e29b-41d4-a716-446655440011");

    await store.findStaffResolved(sessionId);

    expect(db.selects).toHaveLength(1);
  });

  it("returns null when a staff session user organization does not match", async () => {
    const sessionRow = {
      id: "550e8400-e29b-41d4-a716-446655440012",
      actorType: "staff",
      actorId: "550e8400-e29b-41d4-a716-446655440001",
      staffUserId: null,
      organizationId: OrganizationId.DEFAULT,
      customerId: null,
      lastSeenAt: new Date("2026-08-23T02:00:00.000Z"),
      createdAt: new Date("2026-08-23T02:00:00.000Z"),
      updatedAt: new Date("2026-08-23T02:00:00.000Z"),
    };
    const db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: async () => [
                {
                  session: sessionRow,
                  email: "staff@local.test",
                  roles: ["admin"],
                  organizationId: "660e8400-e29b-41d4-a716-446655440099",
                },
              ],
            }),
          }),
        }),
      }),
    };
    const store = new DrizzleSessionStore(db as never);
    const sessionId = SessionId.parse(sessionRow.id);

    await expect(store.findStaffResolved(sessionId)).resolves.toBeNull();
  });
});
