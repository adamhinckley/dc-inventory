import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
} from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { CustomerId, OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE, WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startCatalogApp() {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const productRepo = new InMemoryProductRepository();
  const qtyRead = new InMemoryQtyReadPort();
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });
  await wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "wholesale@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: CUSTOMER_ID,
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-23T03:00:00.000Z")),
    staffUsers,
    wholesaleUsers,
    sessions,
    passwords,
    productRepo,
    qtyRead,
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
  return login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function wholesaleCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: { email: "wholesale@local.test", password: "wholesale-secret" },
  });
  return login.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

describe("catalog HTTP", () => {
  it("requires staff_session on the staff product list and returns 200 with in-memory data", async () => {
    const app = await startCatalogApp();
    const missing = await app.inject({ method: "GET", url: "/internal/products" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const cookie = await staffCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "HEX-BOLT-GALV",
        name: "Galvanized hex bolt",
        uom: "EA",
        memberPriceCents: 1250,
        currency: "USD",
        webWholesale: true,
      },
    });
    expect(created.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as {
      items: Array<{ sku: string; createdAt: string }>;
    };
    expect(listed.json()).toMatchObject({
      page: 1,
      pageSize: 25,
      total: 1,
      items: [
        {
          sku: "HEX-BOLT-GALV",
          name: "Galvanized hex bolt",
          memberPrice: 1250,
          currency: "USD",
          inactive: false,
          discontinued: false,
          webWholesale: true,
          onHand: 0,
          onOrder: 0,
          allocated: 0,
          available: 0,
        },
      ],
    });
    expect(body.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("accepts sortBy=onHand on the staff product list", async () => {
    const app = await startCatalogApp();
    const cookie = await staffCookie(app);
    const rejected = await app.inject({
      method: "GET",
      url: "/internal/products?sortBy=onOrder",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(rejected.statusCode).toBe(400);

    const listed = await app.inject({
      method: "GET",
      url: "/internal/products?sortBy=onHand&sortOrder=desc",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
  });

  it("requires wholesale_session on the shop catalog and hides non-shop SKUs", async () => {
    const app = await startCatalogApp();
    const missing = await app.inject({ method: "GET", url: "/wholesale/catalog" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const staff = await staffCookie(app);
    await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "HEX-BOLT-GALV",
        name: "Galvanized hex bolt",
        uom: "EA",
        memberPriceCents: 1250,
        webWholesale: true,
      },
    });
    const hidden = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "INTERNAL-ONLY",
        name: "Internal washer",
        uom: "EA",
        memberPriceCents: 100,
        webWholesale: false,
      },
    });
    expect(hidden.statusCode).toBe(201);
    const hiddenId = hidden.json().id as string;

    const wholesale = await wholesaleCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().total).toBe(1);
    expect(listed.json().items[0]).toMatchObject({
      name: "Galvanized hex bolt",
      imageUrl: null,
      wholesalePrice: 1250,
      currency: "USD",
      available: 0,
    });

    const hiddenGet = await app.inject({
      method: "GET",
      url: `/wholesale/catalog/${hiddenId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(hiddenGet.statusCode).toBe(404);
    expect(hiddenGet.json()).toEqual({ error: "not_found" });
  });

  it("does not persist qty and keeps sku immutable over HTTP", async () => {
    const app = await startCatalogApp();
    const cookie = await staffCookie(app);
    const created = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "HEX-BOLT-GALV",
        name: "Galvanized hex bolt",
        uom: "EA",
        memberPriceCents: 1250,
        available: 12,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      sku: "HEX-BOLT-GALV",
      available: 0,
      onHand: 0,
    });
    const id = created.json().id as string;

    const patched = await app.inject({
      method: "PATCH",
      url: `/internal/products/${id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { sku: "NEW-SKU", name: "Renamed bolt" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      sku: "HEX-BOLT-GALV",
      name: "Renamed bolt",
    });
  });
});
