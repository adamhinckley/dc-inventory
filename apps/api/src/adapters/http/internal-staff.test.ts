import {
  InMemoryClock,
  InMemoryEmailSender,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  type StaffRole,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startStaffApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const emailSender = new InMemoryEmailSender();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });

  for (const [index, role] of (
    ["admin", "purchasing", "warehouse", "sales_support", "accounting"] as const
  ).entries()) {
    await staffUsers.save({
      id: StaffUserId.parse(`10000000-0000-4000-8000-00000000000${index}`),
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Staff",
      email: `${role}@local.test`,
      passwordHash: await passwords.hash("staff-secret"),
      roles: [role],
    });
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-29T01:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    emailSender,
  });
  apps.push(app);

  async function cookie(role: StaffRole): Promise<string> {
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: "acme",
        email: `${role}@local.test`,
        password: "staff-secret",
      },
    });
    expect(login.statusCode).toBe(200);
    const value = login.cookies.find((item) => item.name === STAFF_SESSION_COOKIE)?.value;
    if (value === undefined) {
      throw new Error("expected staff session cookie");
    }
    return value;
  }

  return { app, cookie, emailSender, staffUsers };
}

describe("internal staff create", () => {
  it("allows admin to create staff and sends an invite email", async () => {
    const { app, cookie, emailSender } = await startStaffApp();
    const admin = await cookie("admin");

    const response = await app.inject({
      method: "POST",
      url: "/internal/staff",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        displayName: "New Warehouse Lead",
        email: "new.warehouse@local.test",
        roles: ["warehouse", "sales_support"],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      displayName: "New Warehouse Lead",
      email: "new.warehouse@local.test",
      roles: ["warehouse", "sales_support"],
    });
    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0]).toMatchObject({
      to: "new.warehouse@local.test",
      subject: "You're invited to Acme Wholesale",
    });
    expect(emailSender.sent[0]?.text).toContain("/set-password?token=");
  });

  it("rejects non-admin roles and unauthenticated requests", async () => {
    const { app, cookie } = await startStaffApp();
    const purchasing = await cookie("purchasing");

    const forbidden = await app.inject({
      method: "POST",
      url: "/internal/staff",
      cookies: { [STAFF_SESSION_COOKIE]: purchasing },
      payload: {
        displayName: "Blocked User",
        email: "blocked@local.test",
        roles: ["warehouse"],
      },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });

    const unauthorized = await app.inject({
      method: "POST",
      url: "/internal/staff",
      payload: {
        displayName: "Blocked User",
        email: "blocked@local.test",
        roles: ["warehouse"],
      },
    });
    expect(unauthorized.statusCode).toBe(401);
  });

  it("rejects invalid payloads and duplicate email", async () => {
    const { app, cookie } = await startStaffApp();
    const admin = await cookie("admin");

    const invalid = await app.inject({
      method: "POST",
      url: "/internal/staff",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        displayName: " ",
        email: "invalid@local.test",
        roles: ["warehouse"],
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "invalid" });

    const emptyRoles = await app.inject({
      method: "POST",
      url: "/internal/staff",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        displayName: "No Roles",
        email: "noroles@local.test",
        roles: [],
      },
    });
    expect(emptyRoles.statusCode).toBe(400);
    expect(emptyRoles.json()).toMatchObject({ error: "invalid_request" });

    const duplicate = await app.inject({
      method: "POST",
      url: "/internal/staff",
      cookies: { [STAFF_SESSION_COOKIE]: admin },
      payload: {
        displayName: "Duplicate",
        email: "admin@local.test",
        roles: ["accounting"],
      },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_email" });
  });
});
