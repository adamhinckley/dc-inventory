import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startCustomersApp() {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-23T03:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
  });
  apps.push(app);
  return app;
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: { email: "staff@local.test", password: "staff-secret" },
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal customers HTTP", () => {
  it("requires staff_session on customers list and CRUD", async () => {
    const app = await startCustomersApp();
    const missing = await app.inject({ method: "GET", url: "/internal/customers" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const cookie = await staffCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it("creates a customer, unique contact email, and exemption without object_key", async () => {
    const app = await startCustomersApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/customers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        name: "Acme Wholesale",
        creditLimitCents: 1_000_000,
        currency: "USD",
        terms: "Net 30",
      },
    });
    expect(created.statusCode).toBe(201);
    const customer = created.json() as { id: string; name: string };
    expect(customer.name).toBe("Acme Wholesale");

    const contact = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/contacts`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Pat Buyer", email: "pat@acme.test" },
    });
    expect(contact.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/contacts`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Other", email: "pat@acme.test" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_email" });

    const exemption = await app.inject({
      method: "POST",
      url: `/internal/customers/${customer.id}/exemption-certificates`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { jurisdiction: "UT", status: "on_file" },
    });
    expect(exemption.statusCode).toBe(201);
    expect(exemption.json()).toMatchObject({
      jurisdiction: "UT",
      objectKey: null,
      entityUseCode: null,
    });
  });
});
