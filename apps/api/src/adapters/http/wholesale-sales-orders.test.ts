import {
  CustomerId,
  Money,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { InMemoryCustomerRepository, InMemoryShipToRepository } from "@dc-inventory/customers";
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
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";
import { API_TEST_SHIP_TO_ID, seedDefaultShipTo } from "./test-ship-to.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_A_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const CUSTOMER_B_ID = CustomerId.parse("44444444-4444-4444-8444-444444444444");
const ACME_SLUG = "acme";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startApp(options?: {
  customerAStatus?: "active" | "on_hold" | "inactive";
  customerBStatus?: "active" | "on_hold" | "inactive";
}) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const shipToRepo = new InMemoryShipToRepository();
  const createdAt = new Date("2026-08-24T03:30:00.000Z");

  async function saveCustomer(
    id: CustomerId,
    name: string,
    customerNumber: string,
    accountStatus: "active" | "on_hold" | "inactive",
  ) {
    await customerRepo.save({
      id,
      organizationId: OrganizationId.DEFAULT,
      name,
      customerNumber,
      creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
      terms: "NET30",
      accountStatus,
      customerNote: `Note for ${name}`,
      createdAt,
    });
  }

  await saveCustomer(
    CUSTOMER_A_ID,
    "Customer A",
    "C-00001",
    options?.customerAStatus ?? "active",
  );
  await saveCustomer(
    CUSTOMER_B_ID,
    "Customer B",
    "C-00002",
    options?.customerBStatus ?? "active",
  );
  await seedDefaultShipTo(shipToRepo, CUSTOMER_A_ID);

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
    customerId: CUSTOMER_A_ID,
  });
  await wholesaleUsers.save({
    id: WholesaleUserId.parse("77777777-7777-4777-8777-777777777777"),
    organizationId: OrganizationId.DEFAULT,
    email: "buyer-b@local.test",
    passwordHash: await passwords.hash("buyer-b-secret"),
    customerId: CUSTOMER_B_ID,
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
    shipToRepo,
  });
  apps.push(app);
  return { app, customerRepo, saveCustomer };
}

function wholesaleCookie(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
) {
  return res.cookies.find((cookie) => cookie.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

function staffCookie(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
) {
  return res.cookies.find((cookie) => cookie.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function loginStaffActing(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: {
      organizationSlug: ACME_SLUG,
      email: "staff@local.test",
      password: "staff-secret",
    },
  });
  return wholesaleCookie(login);
}

async function loginStaffInternal(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: {
      organizationSlug: ACME_SLUG,
      email: "staff@local.test",
      password: "staff-secret",
    },
  });
  return staffCookie(login);
}

async function selectCustomer(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  customerId: string,
) {
  return app.inject({
    method: "POST",
    url: "/wholesale/auth/select-customer",
    cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    payload: { customerId },
  });
}

async function createProduct(
  app: Awaited<ReturnType<typeof buildApp>>,
  staffInternalCookie: string,
  sku: string,
) {
  const product = await app.inject({
    method: "POST",
    url: "/internal/products",
    cookies: { [STAFF_SESSION_COOKIE]: staffInternalCookie },
    payload: {
      sku,
      name: `${sku} product`,
      uom: "EA",
      memberPriceCents: 100,
      listPriceCents: 100,
      webWholesale: true,
    },
  });
  expect(product.statusCode).toBe(201);
  return product.json().id as string;
}

describe("wholesale sales orders (ADA-272)", () => {
  it("staff acting creates draft on on-hold customer", async () => {
    const { app } = await startApp({ customerAStatus: "on_hold" });
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "ON-HOLD-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const order = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json()).toMatchObject({
      customerId: CUSTOMER_A_ID,
      status: "draft",
    });
  });

  it("staff acting rejects draft create on inactive customer", async () => {
    const { app, customerRepo, saveCustomer } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "INACTIVE-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const existing = await customerRepo.findById(OrganizationId.DEFAULT, CUSTOMER_A_ID);
    expect(existing).not.toBeNull();
    await saveCustomer(CUSTOMER_A_ID, "Customer A", "C-00001", "inactive");

    const order = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(order.statusCode).toBe(409);
    expect(order.json()).toEqual({ error: "conflict" });
  });

  it("GET list returns only session customer orders", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "LIST-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 2 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const list = await app.inject({
      method: "GET",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: orderId,
      customerId: CUSTOMER_A_ID,
      status: "draft",
    });
  });

  it("GET by id returns 404 for another customer's order", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const buyerBCookie = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "buyer-b@local.test",
        password: "buyer-b-secret",
      },
    }).then((res) => wholesaleCookie(res));
    const actingCookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "SCOPE-SKU");

    const buyerOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(buyerOrder.statusCode).toBe(201);
    const buyerOrderId = buyerOrder.json().id as string;

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const forbidden = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${buyerOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });
  });

  it("PATCH replace-lines returns 404 for another customer's order without mutating it", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const buyerBCookie = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "buyer-b@local.test",
        password: "buyer-b-secret",
      },
    }).then((res) => wholesaleCookie(res));
    const actingCookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "PATCH-SCOPE-SKU");

    const buyerOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(buyerOrder.statusCode).toBe(201);
    const buyerOrderId = buyerOrder.json().id as string;
    const buyerQtyBefore = buyerOrder.json().lines[0]?.qty as number;

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const forbidden = await app.inject({
      method: "PATCH",
      url: `/wholesale/sales-orders/${buyerOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: { lines: [{ productId, qty: 99 }] },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });

    const buyerRefetch = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${buyerOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
    });
    expect(buyerRefetch.statusCode).toBe(200);
    expect(buyerRefetch.json().lines[0]?.qty).toBe(buyerQtyBefore);
  });

  it("GET by id returns the order for session customer", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "GET-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const fetched = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${orderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({
      id: orderId,
      customerId: CUSTOMER_A_ID,
      status: "draft",
    });
  });

  it("second create returns the same draft for the session customer", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CART-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const first = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().id as string;

    const second = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 2 }] },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().id).toBe(firstId);
    expect(second.json().lines[0]?.qty).toBe(3);
  });

  it("replace-lines cancels the draft when lines are empty", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CLEAR-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const cleared = await app.inject({
      method: "PATCH",
      url: `/wholesale/sales-orders/${orderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [] },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({
      id: orderId,
      status: "cancelled",
      lines: [],
    });
  });

  it("replace-lines merges duplicate SKUs in the request", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "MERGE-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const replaced = await app.inject({
      method: "PATCH",
      url: `/wholesale/sales-orders/${orderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        lines: [
          { productId, qty: 2 },
          { productId, qty: 3 },
        ],
      },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().lines).toHaveLength(1);
    expect(replaced.json().lines[0]?.qty).toBe(5);
  });

  it("GET ship-tos returns session customer addresses", async () => {
    const { app } = await startApp();
    const cookie = await loginStaffActing(app);
    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const response = await app.inject({
      method: "GET",
      url: "/wholesale/ship-tos",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      id: API_TEST_SHIP_TO_ID,
      customerId: CUSTOMER_A_ID,
      line1: "200 Ship St",
      isDefault: true,
    });
  });

  it("POST confirm snapshots ship-to and returns confirmed order", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CONFIRM-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 2 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const confirmed = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        idempotencyKey: "wholesale-confirm",
        shipToId: API_TEST_SHIP_TO_ID,
      },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      id: orderId,
      status: "confirmed",
      shipLine1: "200 Ship St",
      shipCity: "Seattle",
      shipRegion: "WA",
      shipPostal: "98101",
      shipCountry: "US",
    });
  });

  it("POST confirm returns 404 for another customer's order", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const buyerBCookie = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "buyer-b@local.test",
        password: "buyer-b-secret",
      },
    }).then((res) => wholesaleCookie(res));
    const actingCookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CONFIRM-SCOPE-SKU");

    const buyerOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(buyerOrder.statusCode).toBe(201);
    const buyerOrderId = buyerOrder.json().id as string;

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const forbidden = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${buyerOrderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: {
        idempotencyKey: "confirm-scope",
        shipToId: API_TEST_SHIP_TO_ID,
      },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });
  });
});
