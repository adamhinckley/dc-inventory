import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
} from "@dc-inventory/catalog";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "../adapters/http/auth-cookies.js";
import { PHASE1_ORGANIZATION_SLUG } from "./phase1-fixture.js";
import { runPhase1Seed } from "./run-phase1-seed.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Phase 1 seed-shaped HTTP lists", () => {
  it("lets seeded staff and wholesale sessions see an empty catalog", async () => {
    const passwords = new InMemoryPasswordHasher();
    const organizations = new InMemoryOrganizationRepository();
    const staffUsers = new InMemoryStaffUserRepository();
    const wholesaleUsers = new InMemoryWholesaleUserRepository();
    const sessions = new InMemorySessionStore();
    const productRepo = new InMemoryProductRepository();
    const customerRepo = new InMemoryCustomerRepository();
    const qtyRead = new InMemoryQtyReadPort();

    await runPhase1Seed(
      {
        customers: customerRepo,
        organizations,
        staffUsers,
        wholesaleUsers,
        passwords,
      },
      {
        staffPassword: "staff-placeholder",
        wholesalePassword: "wholesale-placeholder",
      },
    );

    const app = await buildApp({
      logger: false,
      database: new InMemoryDatabase(),
      clock: new InMemoryClock(new Date("2026-08-23T04:00:00.000Z")),
      staffUsers,
      wholesaleUsers,
      sessions,
      passwords,
      organizationRepo: organizations,
      customerRepo,
      productRepo,
      qtyRead,
    });
    apps.push(app);

    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: "staff@local.test",
        password: "staff-placeholder",
      },
    });
    expect(staffLogin.statusCode).toBe(200);
    const staffCookie =
      staffLogin.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";

    const staffList = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staffCookie },
    });
    expect(staffList.statusCode).toBe(200);
    expect(staffList.json().total).toBe(0);
    expect(staffList.json().items).toEqual([]);

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-placeholder",
      },
    });
    expect(wholesaleLogin.statusCode).toBe(200);
    const wholesaleCookie =
      wholesaleLogin.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ??
      "";

    const shopList = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookie },
    });
    expect(shopList.statusCode).toBe(200);
    expect(shopList.json().total).toBe(0);
    expect(shopList.json().items).toEqual([]);
  });
});
