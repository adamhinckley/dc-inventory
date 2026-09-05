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
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE, WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";
import { PHASE1_ORGANIZATION_SLUG } from "../../seed/phase1-fixture.js";
import { runPhase1Seed } from "../../seed/run-phase1-seed.js";

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

async function wholesaleCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const wholesaleLogin = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: {
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: "wholesale@local.test",
      password: "wholesale-secret",
    },
  });
  return (
    wholesaleLogin.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? ""
  );
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const staffLogin = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: {
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: "staff@local.test",
      password: "staff-secret",
    },
  });
  return staffLogin.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function staffActingCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: {
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: "staff@local.test",
      password: "staff-secret",
    },
  });
  return login.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

describe("wholesale customers HTTP", () => {
  it("reads own account without staff note and edits customer note only", async () => {
    const app = await startSeededApp();
    const cookie = await wholesaleCookie(app);

    const account = await app.inject({
      method: "GET",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(account.statusCode).toBe(200);
    const body = account.json() as Record<string, unknown>;
    expect(body.customerNumber).toBe("CUST-00001");
    expect(body.accountStatus).toBe("active");
    expect(body).not.toHaveProperty("staffNote");

    const staff = await staffCookie(app);
    const customerId = body.id as string;
    await app.inject({
      method: "PATCH",
      url: `/internal/customers/${customerId}`,
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: { staffNote: "Do not leak" },
    });

    const patched = await app.inject({
      method: "PATCH",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerNote: "Buyer note" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      customerNote: "Buyer note",
      customerNumber: "CUST-00001",
    });
    expect(patched.json()).not.toHaveProperty("staffNote");
  });

  it("writes ship-tos, reads contacts and bill-to, and manages exemption metadata", async () => {
    const app = await startSeededApp();
    const cookie = await wholesaleCookie(app);
    const staff = await staffCookie(app);

    const account = await app.inject({
      method: "GET",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    const customerId = account.json().id as string;

    const missingBillTo = await app.inject({
      method: "GET",
      url: "/wholesale/bill-to",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(missingBillTo.statusCode).toBe(404);
    expect(missingBillTo.json()).toEqual({ error: "not_found" });

    const createdShipTo = await app.inject({
      method: "POST",
      url: "/wholesale/ship-tos",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        line1: "100 Wholesale Way",
        city: "Salt Lake City",
        region: "UT",
        postal: "84101",
        country: "US",
      },
    });
    expect(createdShipTo.statusCode).toBe(201);
    const shipTo = createdShipTo.json() as { id: string; isDefault: boolean };
    expect(shipTo).toMatchObject({
      customerId,
      line1: "100 Wholesale Way",
      city: "Salt Lake City",
      isDefault: false,
    });

    const secondShipTo = await app.inject({
      method: "POST",
      url: "/wholesale/ship-tos",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        line1: "200 Default Dock",
        city: "Provo",
        region: "UT",
        postal: "84601",
        country: "US",
        isDefault: true,
      },
    });
    expect(secondShipTo.statusCode).toBe(201);
    expect(secondShipTo.json()).toMatchObject({ isDefault: true });

    const setDefault = await app.inject({
      method: "PATCH",
      url: `/wholesale/ship-tos/${shipTo.id}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { isDefault: true },
    });
    expect(setDefault.statusCode).toBe(200);
    expect(setDefault.json()).toMatchObject({ id: shipTo.id, isDefault: true });

    const listedShipTos = await app.inject({
      method: "GET",
      url: "/wholesale/ship-tos",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(listedShipTos.statusCode).toBe(200);
    const shipToItems = listedShipTos.json().items as Array<{ id: string; isDefault: boolean }>;
    expect(shipToItems.find((row) => row.id === shipTo.id)?.isDefault).toBe(true);

    await app.inject({
      method: "POST",
      url: `/internal/customers/${customerId}/contacts`,
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: { name: "Buyer Contact", email: "buyer-contact@local.test" },
    });
    await app.inject({
      method: "POST",
      url: `/internal/customers/${customerId}/bill-to`,
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        line1: "500 Billing Blvd",
        city: "Salt Lake City",
        region: "UT",
        postal: "84102",
        country: "US",
      },
    });

    const contacts = await app.inject({
      method: "GET",
      url: "/wholesale/contacts",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(contacts.statusCode).toBe(200);
    expect(contacts.json().items).toEqual([
      expect.objectContaining({
        customerId,
        name: "Buyer Contact",
        email: "buyer-contact@local.test",
      }),
    ]);

    const billTo = await app.inject({
      method: "GET",
      url: "/wholesale/bill-to",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(billTo.statusCode).toBe(200);
    expect(billTo.json()).toMatchObject({
      customerId,
      line1: "500 Billing Blvd",
      city: "Salt Lake City",
    });

    const emptyCerts = await app.inject({
      method: "GET",
      url: "/wholesale/exemption-certificates",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(emptyCerts.statusCode).toBe(200);
    expect(emptyCerts.json().items).toEqual([]);

    const createdCert = await app.inject({
      method: "POST",
      url: "/wholesale/exemption-certificates",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        jurisdiction: "UT",
        status: "active",
        objectKey: "certs/ut-resale.pdf",
      },
    });
    expect(createdCert.statusCode).toBe(201);
    expect(createdCert.json()).toMatchObject({
      customerId,
      jurisdiction: "UT",
      status: "active",
      objectKey: "certs/ut-resale.pdf",
    });

    const listedCerts = await app.inject({
      method: "GET",
      url: "/wholesale/exemption-certificates",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(listedCerts.statusCode).toBe(200);
    expect(listedCerts.json().items).toEqual([
      expect.objectContaining({
        jurisdiction: "UT",
        status: "active",
        objectKey: "certs/ut-resale.pdf",
      }),
    ]);
  });

  it("returns needs_customer on child routes when staff acting has no customer", async () => {
    const app = await startSeededApp();
    const cookie = await staffActingCookie(app);

    for (const { method, url } of [
      { method: "GET", url: "/wholesale/contacts" },
      { method: "GET", url: "/wholesale/bill-to" },
      { method: "GET", url: "/wholesale/exemption-certificates" },
      { method: "POST", url: "/wholesale/ship-tos" },
      { method: "POST", url: "/wholesale/exemption-certificates" },
    ] as const) {
      const response = await app.inject({
        method,
        url,
        cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
        payload:
          method === "POST" && url.endsWith("/ship-tos")
            ? {
                line1: "1 Main",
                city: "SLC",
                region: "UT",
                postal: "84101",
                country: "US",
              }
            : method === "POST"
              ? { jurisdiction: "UT", status: "active" }
              : undefined,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "needs_customer" });
    }
  });
});
