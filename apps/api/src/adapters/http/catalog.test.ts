import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
  type ProductListMatch,
} from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { CustomerId, OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { catalogQuerySchema } from "../../schemas.js";
import { InMemoryDatabase } from "../in-memory-database.js";
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
) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const qtyRead = new InMemoryQtyReadPort();
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
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
    organizationRepo: organizations,
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

  it("passes every declared wholesale filter into the repository query", async () => {
    const productRepo = new RecordingProductRepository();
    const app = await startCatalogApp(productRepo);
    const wholesale = await wholesaleCookie(app);
    const nonFilterParams = new Set(["page", "pageSize", "sortBy", "sortOrder"]);
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
      expect(productRepo.listQueries.at(-1)).toMatchObject({ [filter]: value });
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
    });
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
      "product_id,item,vendor_num,vendor,mp_price,uom,mfg_code,onhand_qty,webwholesale",
      "DC-IMPORT-1,Crystal Drop,1075,REGXJ,10.20,EA,JA149015,99,TRUE",
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
});
