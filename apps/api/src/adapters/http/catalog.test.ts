import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
  type ProductListMatch,
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
import { CustomerId, Money, OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { catalogQuerySchema } from "../../schemas.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { createCatalogListQueryPgliteHarness } from "../support/catalog-list-query-pglite.js";
import { STAFF_SESSION_COOKIE, WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

class RecordingProductRepository extends InMemoryProductRepository {
  readonly listQueries: ProductListMatch[] = [];

  override async listMatching(query: ProductListMatch) {
    this.listQueries.push(query);
    return super.listMatching(query);
  }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startCatalogApp(
  productRepo: InMemoryProductRepository = new InMemoryProductRepository(),
  qtyRead: InMemoryQtyReadPort = new InMemoryQtyReadPort(),
) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  await customerRepo.save({
    id: CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Acme Wholesale",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    createdAt: new Date("2026-08-24T03:30:00.000Z"),
  });
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Staff",
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });
  await wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Wholesale User",
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
    organizationRepo: organizations,
    customerRepo,
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
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  return login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function wholesaleCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: loginBody("wholesale@local.test", "wholesale-secret"),
  });
  return login.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

function productBrowserCsvMultipart(
  csv: string,
  filename = "products.csv",
  contentType = "text/csv",
) {
  const boundary = "----vitestProductBrowser";
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    csv,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  };
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
        memberPriceCents: 12_000,
        listPriceCents: 1250,
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
          memberPrice: 12_000,
          listPrice: 1250,
          currency: "USD",
          inactive: false,
          discontinued: false,
          webWholesale: true,
          onHand: 0,
          onOrder: 0,
          allocated: 0,
          available: 0,
          caseQty: null,
        },
      ],
    });
    expect(body.items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const createdId = (created.json() as { id: string }).id;
    const patched = await app.inject({
      method: "PATCH",
      url: `/internal/products/${createdId}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { caseQty: 192 },
    });
    expect(patched.statusCode).toBe(200);

    const listedWithCaseQty = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listedWithCaseQty.statusCode).toBe(200);
    expect(listedWithCaseQty.json()).toMatchObject({
      items: [{ sku: "HEX-BOLT-GALV", caseQty: 192 }],
    });
  });

  it("accepts inventory snapshot sort keys on the staff product list", async () => {
    const app = await startCatalogApp();
    const cookie = await staffCookie(app);

    for (const sortBy of [
      "onOrder",
      "allocated",
      "committed",
      "availableToSell",
      "sellState",
    ] as const) {
      const listed = await app.inject({
        method: "GET",
        url: `/internal/products?sortBy=${sortBy}&sortOrder=desc`,
        cookies: { [STAFF_SESSION_COOKIE]: cookie },
      });
      expect(listed.statusCode, sortBy).toBe(200);
    }

    const byOnHand = await app.inject({
      method: "GET",
      url: "/internal/products?sortBy=onHand&sortOrder=desc",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byOnHand.statusCode).toBe(200);

    const byCaseQty = await app.inject({
      method: "GET",
      url: "/internal/products?sortBy=caseQty&sortOrder=desc",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byCaseQty.statusCode).toBe(200);
  });

  it("filters the staff product list by category and factory", async () => {
    const productRepo = new InMemoryProductRepository();
    const app = await startCatalogApp(productRepo);
    const cookie = await staffCookie(app);
    const factoryId = "550e8400-e29b-41d4-a716-446655440030";

    const bolt = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "STAFF-BOLT",
        name: "Staff bolt",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    const ribbon = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "STAFF-RIBBON",
        name: "Staff ribbon",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    const boltId = (bolt.json() as { id: string }).id;
    const ribbonId = (ribbon.json() as { id: string }).id;
    productRepo.setCategories(boltId, ["Hardware"]);
    productRepo.setCategories(ribbonId, ["Textiles"]);
    productRepo.setSupplierIds(boltId, [factoryId]);

    const byCategory = await app.inject({
      method: "GET",
      url: "/internal/products?category=Hardware",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byCategory.statusCode).toBe(200);
    expect(byCategory.json().items.map((item: { sku: string }) => item.sku)).toEqual([
      "STAFF-BOLT",
    ]);

    const byFactory = await app.inject({
      method: "GET",
      url: `/internal/products?supplierId=${factoryId}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byFactory.statusCode).toBe(200);
    expect(byFactory.json().items.map((item: { sku: string }) => item.sku)).toEqual([
      "STAFF-BOLT",
    ]);

    const byCategories = await app.inject({
      method: "GET",
      url: "/internal/products?category=Hardware&category=Textiles",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byCategories.statusCode).toBe(200);
    expect(byCategories.json().items.map((item: { sku: string }) => item.sku)).toEqual([
      "STAFF-BOLT",
      "STAFF-RIBBON",
    ]);

    const categories = await app.inject({
      method: "GET",
      url: "/internal/categories",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(categories.statusCode).toBe(200);
    expect(categories.json()).toEqual({
      items: [{ name: "Hardware" }, { name: "Textiles" }],
    });
  });

  it("combines category include with primary-supplier exclude filters", async () => {
    const productRepo = new InMemoryProductRepository();
    const app = await startCatalogApp(productRepo);
    const cookie = await staffCookie(app);
    const factoryA = "550e8400-e29b-41d4-a716-446655440030";
    const factoryB = "550e8400-e29b-41d4-a716-446655440031";

    const bolt = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "COMBO-BOLT",
        name: "Combo bolt",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    const ribbon = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "COMBO-RIBBON",
        name: "Combo ribbon",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    const nail = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "COMBO-NAIL",
        name: "Combo nail",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    const boltId = (bolt.json() as { id: string }).id;
    const ribbonId = (ribbon.json() as { id: string }).id;
    const nailId = (nail.json() as { id: string }).id;
    productRepo.setCategories(boltId, ["Hardware"]);
    productRepo.setCategories(ribbonId, ["Hardware"]);
    productRepo.setCategories(nailId, ["Hardware"]);
    productRepo.setSupplierIds(boltId, [factoryA, factoryB]);
    productRepo.setPrimarySupplierId(boltId, factoryA);
    productRepo.setSupplierIds(ribbonId, [factoryB]);
    productRepo.setPrimarySupplierId(ribbonId, factoryB);

    const byCategoryAndExclude = await app.inject({
      method: "GET",
      url: `/internal/products?category=Hardware&excludeSupplierId=${factoryA}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byCategoryAndExclude.statusCode).toBe(200);
    expect(
      byCategoryAndExclude.json().items.map((item: { sku: string }) => item.sku),
    ).toEqual(["COMBO-NAIL", "COMBO-RIBBON"]);

    const byIncludeAndExclude = await app.inject({
      method: "GET",
      url: `/internal/products?category=Hardware&supplierId=${factoryB}&excludeSupplierId=${factoryA}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(byIncludeAndExclude.statusCode).toBe(200);
    expect(
      byIncludeAndExclude.json().items.map((item: { sku: string }) => item.sku),
    ).toEqual(["COMBO-RIBBON"]);
  });

  it("filters the staff product list by effective sell state", async () => {
    const qtyRead = new InMemoryQtyReadPort();
    const app = await startCatalogApp(undefined, qtyRead);
    const cookie = await staffCookie(app);
    await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "OPEN-SKU",
        name: "Open bolt",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "LOCKED-SKU",
        name: "Locked bolt",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
      },
    });
    qtyRead.set(OrganizationId.DEFAULT, "LOCKED-SKU", {
      onHand: 4,
      onOrder: 2,
      allocated: 0,
      available: 4,
      committed: 1,
      sellState: "locked",
      availableToSell: 5,
    });

    const locked = await app.inject({
      method: "GET",
      url: "/internal/products?sellState=locked",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(locked.statusCode).toBe(200);
    expect(locked.json().items.map((item: { sku: string }) => item.sku)).toEqual([
      "LOCKED-SKU",
    ]);

    const rejected = await app.inject({
      method: "GET",
      url: "/internal/products?sellState=closed",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(rejected.statusCode).toBe(400);

    const exported = await app.inject({
      method: "GET",
      url: "/internal/products/export?format=csv&sellState=locked",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.body).toContain("LOCKED-SKU");
    expect(exported.body).not.toContain("OPEN-SKU");
  });

  it("exports the staff product list as CSV with the same filters", async () => {
    const app = await startCatalogApp();
    const missing = await app.inject({ method: "GET", url: "/internal/products/export" });
    expect(missing.statusCode).toBe(401);

    const cookie = await staffCookie(app);
    await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "HEX-BOLT-GALV",
        name: "Galvanized hex bolt",
        uom: "EA",
        memberPriceCents: 12_000,
        listPriceCents: 1250,
        currency: "USD",
        webWholesale: true,
      },
    });
    await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "WASHER",
        name: "Washer",
        uom: "EA",
        memberPriceCents: 50,
        currency: "USD",
        webWholesale: true,
      },
    });

    const rejected = await app.inject({
      method: "GET",
      url: "/internal/products/export?format=xlsx",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(rejected.statusCode).toBe(400);

    const exported = await app.inject({
      method: "GET",
      url: "/internal/products/export?format=csv&q=HEX",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toMatch(/text\/csv/);
    expect(exported.headers["content-disposition"]).toContain("products.csv");
    expect(exported.body).toContain("SKU,Name,List price,Unit cost");
    expect(exported.body).toContain("HEX-BOLT-GALV");
    expect(exported.body).not.toContain("WASHER");
  });

  it("requires wholesale_session on the shop catalog and hides non-shop SKUs", async () => {
    const productRepo = new InMemoryProductRepository();
    const app = await startCatalogApp(productRepo);
    const missing = await app.inject({ method: "GET", url: "/wholesale/catalog" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });
    const missingCategories = await app.inject({
      method: "GET",
      url: "/wholesale/catalog/categories",
    });
    expect(missingCategories.statusCode).toBe(401);

    const staff = await staffCookie(app);
    const visible = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "HEX-BOLT-GALV",
        name: "Galvanized hex bolt",
        uom: "EA",
        memberPriceCents: 10_200,
        listPriceCents: 1250,
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
        listPriceCents: 100,
        webWholesale: false,
      },
    });
    expect(hidden.statusCode).toBe(201);
    const hiddenId = hidden.json().id as string;
    productRepo.setCategories(visible.json().id as string, ["Hardware"]);
    productRepo.setCategories(hiddenId, ["Staff only"]);

    const wholesale = await wholesaleCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/wholesale/catalog?availableOnly=false",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().total).toBe(1);
    expect(listed.json().items[0]).toMatchObject({
      sku: "HEX-BOLT-GALV",
      name: "Galvanized hex bolt",
      description: null,
      imageUrl: null,
      wholesalePrice: 1250,
      currency: "USD",
      available: 0,
    });

    const shopCategories = await app.inject({
      method: "GET",
      url: "/wholesale/catalog/categories",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(shopCategories.statusCode).toBe(200);
    expect(shopCategories.json()).toEqual({ items: [{ name: "Hardware" }] });

    const hiddenGet = await app.inject({
      method: "GET",
      url: `/wholesale/catalog/${hiddenId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(hiddenGet.statusCode).toBe(404);
    expect(hiddenGet.json()).toEqual({ error: "not_found" });
  });

  it("defaults the wholesale catalog to sellable products only", async () => {
    const qtyRead = new InMemoryQtyReadPort();
    const app = await startCatalogApp(new InMemoryProductRepository(), qtyRead);
    const staff = await staffCookie(app);
    const stocked = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "SHOP-STOCKED",
        name: "Shop stocked",
        uom: "EA",
        memberPriceCents: 500,
        listPriceCents: 500,
        webWholesale: true,
      },
    });
    expect(stocked.statusCode).toBe(201);
    const openEmpty = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "SHOP-OPEN-EMPTY",
        name: "Shop open empty",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
        webWholesale: true,
      },
    });
    expect(openEmpty.statusCode).toBe(201);
    const onFactoryPo = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "SHOP-ON-PO",
        name: "Shop on factory PO",
        uom: "EA",
        memberPriceCents: 200,
        listPriceCents: 200,
        webWholesale: true,
      },
    });
    expect(onFactoryPo.statusCode).toBe(201);
    const lockedLeftover = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staff },
      payload: {
        sku: "SHOP-LOCKED-LEFTOVER",
        name: "Shop locked leftover",
        uom: "EA",
        memberPriceCents: 300,
        listPriceCents: 300,
        webWholesale: true,
      },
    });
    expect(lockedLeftover.statusCode).toBe(201);

    qtyRead.set(OrganizationId.DEFAULT, "SHOP-STOCKED", {
      onHand: 4,
      onOrder: 0,
      allocated: 0,
      available: 4,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    qtyRead.set(OrganizationId.DEFAULT, "SHOP-OPEN-EMPTY", {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    qtyRead.set(OrganizationId.DEFAULT, "SHOP-ON-PO", {
      onHand: 0,
      onOrder: 100,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "locked",
      availableToSell: 100,
    });
    qtyRead.set(OrganizationId.DEFAULT, "SHOP-LOCKED-LEFTOVER", {
      onHand: 5,
      onOrder: 0,
      allocated: 0,
      available: 5,
      committed: 5,
      sellState: "locked",
      availableToSell: 0,
    });

    const wholesale = await wholesaleCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().total).toBe(3);
    expect(listed.json().items.map((item: { name: string }) => item.name).sort()).toEqual([
      "Shop on factory PO",
      "Shop open empty",
      "Shop stocked",
    ]);

    const includeUnavailable = await app.inject({
      method: "GET",
      url: "/wholesale/catalog?availableOnly=false",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(includeUnavailable.statusCode).toBe(200);
    expect(includeUnavailable.json().total).toBe(4);
  });

  async function seedWholesaleAvailabilityMatrix(
    app: Awaited<ReturnType<typeof buildApp>>,
    staff: string,
    qtyRead: InMemoryQtyReadPort,
  ) {
    const skus = [
      { sku: "MATRIX-OPEN-STOCKED", name: "Matrix open stocked" },
      { sku: "MATRIX-OPEN-EMPTY", name: "Matrix open empty" },
      { sku: "MATRIX-LOCKED-PO", name: "Matrix locked on PO" },
      { sku: "MATRIX-LOCKED-SOLD-OUT", name: "Matrix locked sold out" },
    ] as const;
    for (const row of skus) {
      const created = await app.inject({
        method: "POST",
        url: "/internal/products",
        cookies: { [STAFF_SESSION_COOKIE]: staff },
        payload: {
          sku: row.sku,
          name: row.name,
          uom: "EA",
          memberPriceCents: 100,
          listPriceCents: 100,
          webWholesale: true,
        },
      });
      expect(created.statusCode).toBe(201);
    }
    qtyRead.set(OrganizationId.DEFAULT, "MATRIX-OPEN-STOCKED", {
      onHand: 4,
      onOrder: 0,
      allocated: 0,
      available: 4,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    qtyRead.set(OrganizationId.DEFAULT, "MATRIX-OPEN-EMPTY", {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "open",
      availableToSell: null,
    });
    qtyRead.set(OrganizationId.DEFAULT, "MATRIX-LOCKED-PO", {
      onHand: 0,
      onOrder: 100,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "locked",
      availableToSell: 100,
    });
    qtyRead.set(OrganizationId.DEFAULT, "MATRIX-LOCKED-SOLD-OUT", {
      onHand: 5,
      onOrder: 100,
      allocated: 0,
      available: 5,
      committed: 100,
      sellState: "locked",
      availableToSell: 0,
    });
  }

  async function listWholesaleSkus(
    app: Awaited<ReturnType<typeof buildApp>>,
    wholesale: string,
    query = "",
  ) {
    const response = await app.inject({
      method: "GET",
      url: `/wholesale/catalog${query}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
    });
    expect(response.statusCode).toBe(200);
    return (response.json().items as Array<{ sku: string }>).map((item) => item.sku).sort();
  }

  it("filters wholesale catalog by inStockOnly x preOrder query params", async () => {
    const qtyRead = new InMemoryQtyReadPort();
    const app = await startCatalogApp(new InMemoryProductRepository(), qtyRead);
    const staff = await staffCookie(app);
    await seedWholesaleAvailabilityMatrix(app, staff, qtyRead);
    const wholesale = await wholesaleCookie(app);

    const defaultListed = await listWholesaleSkus(app, wholesale);
    const legacyAvailableOnly = await listWholesaleSkus(app, wholesale, "?availableOnly=true");
    const explicitBothOn = await listWholesaleSkus(
      app,
      wholesale,
      "?inStockOnly=true&preOrder=true",
    );
    expect(defaultListed).toEqual([
      "MATRIX-LOCKED-PO",
      "MATRIX-OPEN-EMPTY",
      "MATRIX-OPEN-STOCKED",
    ]);
    expect(legacyAvailableOnly).toEqual(defaultListed);
    expect(explicitBothOn).toEqual(defaultListed);

    const inStockOnPreOrderOff = await listWholesaleSkus(
      app,
      wholesale,
      "?inStockOnly=true&preOrder=false",
    );
    expect(inStockOnPreOrderOff).toEqual(["MATRIX-LOCKED-PO"]);

    const inStockOffPreOrderOn = await listWholesaleSkus(
      app,
      wholesale,
      "?inStockOnly=false&preOrder=true",
    );
    expect(inStockOffPreOrderOn).toEqual(["MATRIX-OPEN-EMPTY", "MATRIX-OPEN-STOCKED"]);

    const bothOff = await listWholesaleSkus(app, wholesale, "?inStockOnly=false&preOrder=false");
    const legacyUnavailable = await listWholesaleSkus(app, wholesale, "?availableOnly=false");
    expect(bothOff).toEqual([
      "MATRIX-LOCKED-PO",
      "MATRIX-LOCKED-SOLD-OUT",
      "MATRIX-OPEN-EMPTY",
      "MATRIX-OPEN-STOCKED",
    ]);
    expect(legacyUnavailable).toEqual(bothOff);
  });

  it("passes every declared wholesale filter into the repository query", async () => {
    const productRepo = new RecordingProductRepository();
    const app = await startCatalogApp(productRepo);
    const wholesale = await wholesaleCookie(app);
    const nonFilterParams = new Set([
      "page",
      "pageSize",
      "sortBy",
      "sortOrder",
      "availableOnly",
      "inStockOnly",
      "preOrder",
    ]);
    const declaredFilters = Object.keys(catalogQuerySchema.shape).filter(
      (name) => !nonFilterParams.has(name),
    );
    const cases = {
      q: "bolt",
      category: "Hardware",
    } satisfies Record<string, string>;

    expect(declaredFilters.sort()).toEqual(Object.keys(cases).sort());
    for (const filter of declaredFilters) {
      const value = cases[filter as keyof typeof cases];
      const response = await app.inject({
        method: "GET",
        url: `/wholesale/catalog?${filter}=${encodeURIComponent(value)}`,
        cookies: { [WHOLESALE_SESSION_COOKIE]: wholesale },
      });

      expect(response.statusCode).toBe(200);
      expect(productRepo.listQueries.at(-1)).toMatchObject({
        [filter]: filter === "category" ? [value] : value,
      });
    }
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
      caseQty: null,
    });

    const bySku = await app.inject({
      method: "PATCH",
      url: "/internal/products/sku/HEX-BOLT-GALV",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { caseQty: 192 },
    });
    expect(bySku.statusCode).toBe(200);
    expect(bySku.json()).toMatchObject({
      sku: "HEX-BOLT-GALV",
      caseQty: 192,
    });

    const fetched = await app.inject({
      method: "GET",
      url: `/internal/products/${id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ caseQty: 192 });
  });

  it("imports Product Browser CSV over multipart and ignores qty columns", async () => {
    const app = await startCatalogApp();
    const missing = await app.inject({
      method: "POST",
      url: "/internal/products/import",
    });
    expect(missing.statusCode).toBe(401);

    const cookie = await staffCookie(app);
    const notMultipart = await app.inject({
      method: "POST",
      url: "/internal/products/import",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { dryRun: true },
    });
    expect(notMultipart.statusCode).toBe(400);
    expect(notMultipart.json()).toEqual({ error: "invalid" });

    const csv = [
      "product_id,item,vendor_num,vendor,mp_price,lp_price,uom,mfg_code,onhand_qty,webwholesale,category_1,category_2",
      "DC-IMPORT-1,Crystal Drop,1075,REGXJ,10.20,12.75,EA,JA149015,99,TRUE,Shopify,Christmas Stems & Sprays",
    ].join("\n");
    const multipart = productBrowserCsvMultipart(csv);

    const dryRun = await app.inject({
      method: "POST",
      url: "/internal/products/import?dryRun=true",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      headers: multipart.headers,
      payload: multipart.payload,
    });
    expect(dryRun.statusCode).toBe(200);
    expect(dryRun.json()).toMatchObject({
      dryRun: true,
      rowsOk: 1,
      created: 0,
      updated: 0,
      linked: 0,
      errors: [],
    });

    const emptyList = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(emptyList.json().total).toBe(0);

    const committed = await app.inject({
      method: "POST",
      url: "/internal/products/import",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      headers: multipart.headers,
      payload: multipart.payload,
    });
    expect(committed.statusCode).toBe(200);
    expect(committed.json()).toMatchObject({
      dryRun: false,
      rowsOk: 1,
      created: 1,
      updated: 0,
      linked: 1,
      errors: [],
    });

    const listed = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      total: 1,
      items: [
        {
          sku: "DC-IMPORT-1",
          name: "Crystal Drop",
          memberPrice: 1020,
          listPrice: 1275,
          available: 0,
          onHand: 0,
        },
      ],
    });

    const vendors = await app.inject({
      method: "GET",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(vendors.statusCode).toBe(200);
    expect(vendors.json()).toMatchObject({
      total: 1,
      items: [{ vendorNumber: "1075", name: "REGXJ" }],
    });

    const categoryList = await app.inject({
      method: "GET",
      url: "/internal/categories",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(categoryList.statusCode).toBe(200);
    expect(categoryList.json().items.map((row: { name: string }) => row.name).sort()).toEqual([
      "Christmas Stems & Sprays",
      "Shopify",
    ]);

    const filtered = await app.inject({
      method: "GET",
      url: "/internal/products?category=Shopify",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toMatchObject({
      total: 1,
      items: [{ sku: "DC-IMPORT-1" }],
    });

    const reimport = await app.inject({
      method: "POST",
      url: "/internal/products/import",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      headers: multipart.headers,
      payload: multipart.payload,
    });
    expect(reimport.statusCode).toBe(200);
    expect(reimport.json()).toMatchObject({
      dryRun: false,
      rowsOk: 1,
      created: 0,
      updated: 1,
      linked: 1,
      errors: [],
    });
  });

  it("rejects Excel workbooks as invalid instead of 500", async () => {
    const app = await startCatalogApp();
    const cookie = await staffCookie(app);
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 1, 2, 3]).toString(
      "latin1",
    );
    const multipart = productBrowserCsvMultipart(
      ole,
      "product_browser.xls",
      "application/vnd.ms-excel",
    );
    const res = await app.inject({
      method: "POST",
      url: "/internal/products/import",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      headers: multipart.headers,
      payload: multipart.payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid" });
  });

  it("returns bigint supplier lastPoCostCents on the staff product list", async () => {
    const harness = await createCatalogListQueryPgliteHarness();
    try {
      const passwords = new InMemoryPasswordHasher();
      const organizations = new InMemoryOrganizationRepository();
      await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
      const staffUsers = new InMemoryStaffUserRepository();
      const sessions = new InMemorySessionStore();
      await staffUsers.save({
        id: STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        displayName: "Test Staff",
        email: "staff@local.test",
        passwordHash: await passwords.hash("staff-secret"),
        roles: ["admin"],
      });
      const app = await buildApp({
        logger: false,
        database: new InMemoryDatabase(),
        staffUsers,
        sessions,
        passwords,
        organizationRepo: organizations,
        catalogListQuery: harness.catalogListQuery,
      });
      apps.push(app);
      const cookie = await staffCookie(app);
      const listed = await app.inject({
        method: "GET",
        url: "/internal/products",
        cookies: { [STAFF_SESSION_COOKIE]: cookie },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().total).toBe(2);
      expect(listed.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sku: "LAST-PO-COST-500",
            lastPoCostCents: 500,
            supplierName: "Acme Supply",
          }),
        ]),
      );
    } finally {
      await harness.close();
    }
  });
});
