import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
} from "@dc-inventory/catalog";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { InMemorySupplierRepository } from "@dc-inventory/purchasing";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "../adapters/http/auth-cookies.js";
import {
  PHASE1_PRODUCT_SKUS,
  PHASE1_PRODUCTS,
  PHASE1_SUPPLIER_NAME,
  PHASE1_SUPPLIER_VENDOR_NUMBER,
} from "./phase1-fixture.js";
import { runPhase1Seed } from "./run-phase1-seed.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Phase 1 seed-shaped HTTP lists", () => {
  it("lets seeded staff and wholesale sessions list the five shop SKUs", async () => {
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();
    const wholesaleUsers = new InMemoryWholesaleUserRepository();
    const sessions = new InMemorySessionStore();
    const productRepo = new InMemoryProductRepository();
    const customerRepo = new InMemoryCustomerRepository();
    const qtyRead = new InMemoryQtyReadPort();
    const supplierRepo = new InMemorySupplierRepository();

    await runPhase1Seed(
      {
        products: productRepo,
        customers: customerRepo,
        staffUsers,
        wholesaleUsers,
        suppliers: supplierRepo,
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
      customerRepo,
      productRepo,
      qtyRead,
      supplierRepo,
    });
    apps.push(app);

    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: { email: "staff@local.test", password: "staff-placeholder" },
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
    expect(staffList.json().total).toBe(5);
    expect(staffList.json().items.map((row: { sku: string }) => row.sku).sort()).toEqual(
      [...PHASE1_PRODUCT_SKUS].sort(),
    );

    const suppliers = await app.inject({
      method: "GET",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: staffCookie },
    });
    expect(suppliers.statusCode).toBe(200);
    expect(suppliers.json().items).toEqual([
      {
        id: expect.any(String),
        vendorNumber: PHASE1_SUPPLIER_VENDOR_NUMBER,
        name: PHASE1_SUPPLIER_NAME,
      },
    ]);
    for (const item of staffList.json().items as Array<{
      available: number;
      imageUrl?: unknown;
    }>) {
      expect(item.available).toBe(0);
    }

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: { email: "wholesale@local.test", password: "wholesale-placeholder" },
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
    expect(shopList.json().total).toBe(5);
    const shopItems = shopList.json().items as Array<{
      name: string;
      imageUrl: string | null;
      wholesalePrice: number;
      available: number;
    }>;
    expect(shopItems).toHaveLength(5);
    const prices = new Map(PHASE1_PRODUCTS.map((row) => [row.name, row.memberPriceCents]));
    for (const item of shopItems) {
      expect(item.imageUrl).toBeNull();
      expect(item.available).toBe(0);
      expect(item.wholesalePrice).toBe(prices.get(item.name));
    }
  });
});
