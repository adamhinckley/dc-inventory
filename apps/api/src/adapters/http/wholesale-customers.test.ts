import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE, WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";
import { PHASE1_ORGANIZATION_SLUG } from "../../seed/phase1-fixture.js";
import { runPhase1Seed } from "../../seed/run-phase1-seed.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSeededApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();

  await runPhase1Seed(
    {
      customers: customerRepo,
      organizations,
      staffUsers,
      wholesaleUsers,
      passwords,
    },
    {
      staffPassword: "staff-secret",
      wholesalePassword: "wholesale-secret",
    },
  );

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-23T03:00:00.000Z")),
    staffUsers,
    wholesaleUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    customerRepo,
  });
  apps.push(app);
  return app;
}

describe("wholesale customers HTTP", () => {
  it("reads own account without staff note and edits customer note only", async () => {
    const app = await startSeededApp();

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    expect(wholesaleLogin.statusCode).toBe(200);
    const wholesaleCookie =
      wholesaleLogin.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";

    const account = await app.inject({
      method: "GET",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookie },
    });
    expect(account.statusCode).toBe(200);
    const body = account.json() as Record<string, unknown>;
    expect(body.customerNumber).toBe("CUST-00001");
    expect(body.accountStatus).toBe("active");
    expect(body).not.toHaveProperty("staffNote");

    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    const staffCookie =
      staffLogin.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
    const customerId = body.id as string;
    await app.inject({
      method: "PATCH",
      url: `/internal/customers/${customerId}`,
      cookies: { [STAFF_SESSION_COOKIE]: staffCookie },
      payload: { staffNote: "Do not leak" },
    });

    const patched = await app.inject({
      method: "PATCH",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookie },
      payload: { customerNote: "Buyer note" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      customerNote: "Buyer note",
      customerNumber: "CUST-00001",
    });
    expect(patched.json()).not.toHaveProperty("staffNote");
  });
});
