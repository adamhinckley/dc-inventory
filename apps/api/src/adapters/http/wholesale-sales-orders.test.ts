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
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";
import {
  API_TEST_SHIP_TO_ID,
  API_TEST_SHIP_TO_ID_B,
  seedDefaultShipTo,
  seedShipTo,
} from "./test-ship-to.js";

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
  customerACreditLimitCents?: number;
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
    creditLimitCents = options?.customerACreditLimitCents ?? 1_000_000,
  ) {
    await customerRepo.save({
      id,
      organizationId: OrganizationId.DEFAULT,
      name,
      customerNumber,
      creditLimit: Money.fromMinorUnits(creditLimitCents, "USD"),
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
  return { app, customerRepo, saveCustomer, shipToRepo };
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

  it("list batches product-id lookup once per page when orders share SKUs", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "BATCH-LIST-SKU");
    const batchLookupSpy = vi.spyOn(app.catalog, "lookupProductIdsBySkus");
    const singleLookupSpy = vi.spyOn(app.catalog, "lookupProductIdBySku");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    for (let index = 0; index < 2; index += 1) {
      const created = await app.inject({
        method: "POST",
        url: "/wholesale/sales-orders",
        cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
        payload: { lines: [{ productId, qty: index + 1 }] },
      });
      expect(created.statusCode).toBe(201);
    }

    batchLookupSpy.mockClear();
    singleLookupSpy.mockClear();

    const listed = await app.inject({
      method: "GET",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    const items = listed.json().items as Array<{ lines: Array<{ productId?: string }> }>;
    expect(items).toHaveLength(2);
    expect(batchLookupSpy).toHaveBeenCalledTimes(1);
    expect(batchLookupSpy.mock.calls[0]?.[1]).toEqual(["BATCH-LIST-SKU"]);
    expect(singleLookupSpy).not.toHaveBeenCalled();
    for (const item of items) {
      expect(item.lines[0]?.productId).toBe(productId);
    }
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
    expect(created.json().lines[0]?.productId).toBe(productId);
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

  it("second create opens a second labelled draft; both list as open carts", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CART-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const first = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }], label: "  Spring reorder " },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().label).toBe("Spring reorder");
    const firstId = first.json().id as string;

    const second = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 2 }] },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().id).not.toBe(firstId);
    expect(second.json().lines[0]?.qty).toBe(2);
    expect(second.json()).not.toHaveProperty("label");

    const drafts = await app.inject({
      method: "GET",
      url: "/wholesale/sales-orders?status=draft&sortBy=documentNumber&sortOrder=desc",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(drafts.statusCode).toBe(200);
    expect(drafts.json().total).toBe(2);
    expect(drafts.json().items.map((item: { id: string }) => item.id)).toEqual([
      second.json().id,
      firstId,
    ]);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/wholesale/sales-orders/${firstId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }], label: "Spring 2027" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().label).toBe("Spring 2027");

    const cleared = await app.inject({
      method: "PATCH",
      url: `/wholesale/sales-orders/${firstId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }], label: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).not.toHaveProperty("label");
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

  it("POST line-jobs updates qty on a draft order", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "DELTA-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const updated = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/line-jobs`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { update: [{ sku: "DELTA-SKU", qty: 4 }] },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: orderId,
      status: "draft",
      lines: [{ sku: "DELTA-SKU", qty: 4 }],
    });
  });

  it("line-jobs cancels the draft when the last line is removed", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "DELTA-CLEAR-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const order = created.json() as { id: string; lines: Array<{ id: string }> };
    const lineId = order.lines[0]?.id;
    expect(lineId).toBeDefined();

    const cleared = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${order.id}/line-jobs`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { remove: [lineId] },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({
      id: order.id,
      status: "cancelled",
      lines: [],
    });
  });

  it("line-jobs returns 404 for another customer's order without mutating it", async () => {
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
    const productId = await createProduct(app, staffInternal, "DELTA-SCOPE-SKU");

    const buyerOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(buyerOrder.statusCode).toBe(201);
    const buyerOrderId = buyerOrder.json().id as string;
    const buyerLineId = buyerOrder.json().lines[0]?.id as string;

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const forbidden = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${buyerOrderId}/line-jobs`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: { update: [{ lineId: buyerLineId, qty: 99 }] },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });

    const buyerRefetch = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${buyerOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
    });
    expect(buyerRefetch.statusCode).toBe(200);
    expect(buyerRefetch.json().lines[0]?.qty).toBe(1);
  });

  it("rejects line-jobs without wholesale session", async () => {
    const { app } = await startApp();
    const response = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders/11111111-1111-4111-8111-111111111111/line-jobs",
      payload: { update: [{ sku: "NO-AUTH", qty: 1 }] },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
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

  it("GET ship-tos does not return another customer's addresses", async () => {
    const { app, shipToRepo } = await startApp();
    await seedShipTo(shipToRepo, CUSTOMER_B_ID, API_TEST_SHIP_TO_ID_B, "300 Buyer B St");

    const buyerBCookie = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "buyer-b@local.test",
        password: "buyer-b-secret",
      },
    }).then((res) => wholesaleCookie(res));

    const response = await app.inject({
      method: "GET",
      url: "/wholesale/ship-tos",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
    });
    expect(response.statusCode).toBe(200);
    const items = response.json().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: API_TEST_SHIP_TO_ID_B,
      customerId: CUSTOMER_B_ID,
      line1: "300 Buyer B St",
    });
    expect(items.every((item: { id: string }) => item.id !== API_TEST_SHIP_TO_ID)).toBe(true);
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

  it("buyer confirm returns credit_exceeded and ignores overrideCredit", async () => {
    const { app } = await startApp({ customerACreditLimitCents: 0 });
    const staffInternal = await loginStaffInternal(app);
    const buyerCookie = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    }).then((res) => wholesaleCookie(res));
    const productId = await createProduct(app, staffInternal, "CREDIT-BLOCK-SKU");

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
      payload: { lines: [{ productId, qty: 2 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const blocked = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
      payload: {
        idempotencyKey: "buyer-credit-block",
        shipToId: API_TEST_SHIP_TO_ID,
      },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({
      error: "credit_exceeded",
      availableCreditCents: 0,
      orderTotalCents: 200,
    });

    const ignoredOverride = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
      payload: {
        idempotencyKey: "buyer-credit-override-ignored",
        shipToId: API_TEST_SHIP_TO_ID,
        overrideCredit: true,
      },
    });
    expect(ignoredOverride.statusCode).toBe(409);
    expect(ignoredOverride.json()).toEqual({
      error: "credit_exceeded",
      availableCreditCents: 0,
      orderTotalCents: 200,
    });
  });

  it("staff acting override confirms and stamps creditLimitOverriddenByStaffUserId", async () => {
    const { app } = await startApp({ customerACreditLimitCents: 0 });
    const staffInternal = await loginStaffInternal(app);
    const actingCookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "CREDIT-OVERRIDE-SKU");

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().id as string;

    const blocked = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: {
        idempotencyKey: "acting-credit-block",
        shipToId: API_TEST_SHIP_TO_ID,
      },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({
      error: "credit_exceeded",
      availableCreditCents: 0,
      orderTotalCents: 100,
    });

    const confirmed = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${orderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
      payload: {
        idempotencyKey: "acting-credit-override",
        shipToId: API_TEST_SHIP_TO_ID,
        overrideCredit: true,
      },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      id: orderId,
      status: "confirmed",
      creditLimitOverriddenByStaffUserId: STAFF_ID,
    });
  });

  it("POST confirm returns 404 for another customer's order", async () => {
    const { app, shipToRepo } = await startApp();
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
    await seedShipTo(shipToRepo, CUSTOMER_B_ID, API_TEST_SHIP_TO_ID_B, "300 Buyer B St");

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
        shipToId: API_TEST_SHIP_TO_ID_B,
      },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });

    const victim = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${buyerOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
    });
    expect(victim.statusCode).toBe(200);
    expect(victim.json().status).toBe("draft");
  });

  it("GET by document number returns the confirmed order for the session customer", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "BY-NUMBER-SKU");

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
        idempotencyKey: "by-number-confirm",
        shipToId: API_TEST_SHIP_TO_ID,
      },
    });
    expect(confirmed.statusCode).toBe(200);
    const documentNumber = confirmed.json().documentNumber as string;
    expect(documentNumber).toMatch(/^SO-/);

    const fetched = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/by-document-number/${documentNumber}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({
      id: orderId,
      documentNumber,
      customerId: CUSTOMER_A_ID,
      status: "confirmed",
      shipLine1: "200 Ship St",
    });
  });

  it("GET by document number returns 404 for a draft", async () => {
    const { app } = await startApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);
    const productId = await createProduct(app, staffInternal, "BY-NUMBER-DRAFT-SKU");

    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const created = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(created.statusCode).toBe(201);
    const documentNumber = created.json().documentNumber as string;
    expect(created.json().status).toBe("draft");

    const fetched = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/by-document-number/${documentNumber}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(fetched.statusCode).toBe(404);
    expect(fetched.json()).toEqual({ error: "not_found" });
  });

  it("GET by document number returns 404 for another customer's order", async () => {
    const { app, shipToRepo } = await startApp();
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
    const productId = await createProduct(app, staffInternal, "BY-NUMBER-SCOPE-SKU");
    await seedShipTo(shipToRepo, CUSTOMER_B_ID, API_TEST_SHIP_TO_ID_B, "300 Buyer B St");

    const buyerOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: { lines: [{ productId, qty: 1 }] },
    });
    expect(buyerOrder.statusCode).toBe(201);
    const buyerOrderId = buyerOrder.json().id as string;

    const confirmed = await app.inject({
      method: "POST",
      url: `/wholesale/sales-orders/${buyerOrderId}/confirm`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: {
        idempotencyKey: "by-number-scope-confirm",
        shipToId: API_TEST_SHIP_TO_ID_B,
      },
    });
    expect(confirmed.statusCode).toBe(200);
    const documentNumber = confirmed.json().documentNumber as string;

    await selectCustomer(app, actingCookie, CUSTOMER_A_ID);

    const forbidden = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/by-document-number/${documentNumber}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: actingCookie },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });
  });

  it("GET by document number returns 404 when the number is missing", async () => {
    const { app } = await startApp();
    const cookie = await loginStaffActing(app);
    await selectCustomer(app, cookie, CUSTOMER_A_ID);

    const missing = await app.inject({
      method: "GET",
      url: "/wholesale/sales-orders/by-document-number/SO-99999",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });
  });
});
