import {
  CustomerId,
  Money,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
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
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_A_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const CUSTOMER_B_ID = CustomerId.parse("44444444-4444-4444-8444-444444444444");
const ACME_SLUG = "acme";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startActingApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const createdAt = new Date("2026-08-24T03:30:00.000Z");

  await customerRepo.save({
    id: CUSTOMER_A_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Customer A",
    customerNumber: "C-00001",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "active",
    customerNote: "Note for A",
    createdAt,
  });
  await customerRepo.save({
    id: CUSTOMER_B_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Customer B",
    customerNumber: "C-00002",
    creditLimit: Money.fromMinorUnits(2_000_000, "USD"),
    terms: "NET60",
    accountStatus: "active",
    customerNote: "Note for B",
    createdAt,
  });

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
  });
  apps.push(app);
  return app;
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

describe("wholesale staff acting data route isolation", () => {
  it("keeps auth routes reachable when customerId is null", async () => {
    const app = await startActingApp();
    const cookie = await loginStaffActing(app);

    const session = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({
      mode: "staff_acting",
      customerId: null,
    });

    const customers = await app.inject({
      method: "GET",
      url: "/wholesale/auth/customers",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(customers.statusCode).toBe(200);
  });

  it("returns needs_customer on data routes when staff acting has no customer", async () => {
    const app = await startActingApp();
    const cookie = await loginStaffActing(app);

    for (const url of ["/wholesale/catalog", "/wholesale/account"]) {
      const response = await app.inject({
        method: "GET",
        url,
        cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "needs_customer" });
    }

    const createOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        lines: [{ productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", qty: 1 }],
      },
    });
    expect(createOrder.statusCode).toBe(403);
    expect(createOrder.json()).toEqual({ error: "needs_customer" });
  });

  it("returns 401 when staff_session is used on wholesale data routes", async () => {
    const app = await startActingApp();
    const cookie = await loginStaffInternal(app);

    for (const url of ["/wholesale/catalog", "/wholesale/account"]) {
      const response = await app.inject({
        method: "GET",
        url,
        cookies: { [STAFF_SESSION_COOKIE]: cookie },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    }

    const postOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        lines: [{ productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", qty: 1 }],
      },
    });
    expect(postOrder.statusCode).toBe(401);
    expect(postOrder.json()).toEqual({ error: "unauthorized" });
  });

  it("scopes account reads to the session customer after selection", async () => {
    const app = await startActingApp();
    const cookie = await loginStaffActing(app);

    const selectA = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_A_ID },
    });
    expect(selectA.statusCode).toBe(200);

    const accountA = await app.inject({
      method: "GET",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(accountA.statusCode).toBe(200);
    expect(accountA.json()).toMatchObject({
      id: CUSTOMER_A_ID,
      name: "Customer A",
      customerNumber: "C-00001",
      customerNote: "Note for A",
    });
    expect(accountA.json()).not.toMatchObject({
      name: "Customer B",
      customerNumber: "C-00002",
    });

    const selectB = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_B_ID },
    });
    expect(selectB.statusCode).toBe(200);

    const accountB = await app.inject({
      method: "GET",
      url: "/wholesale/account",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(accountB.statusCode).toBe(200);
    expect(accountB.json()).toMatchObject({
      id: CUSTOMER_B_ID,
      name: "Customer B",
      customerNumber: "C-00002",
      customerNote: "Note for B",
    });
    expect(accountB.json()).not.toMatchObject({
      name: "Customer A",
      customerNumber: "C-00001",
    });
  });

  it("runs staff acting flow through catalog and sales order create and fetch", async () => {
    const app = await startActingApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);

    const customers = await app.inject({
      method: "GET",
      url: "/wholesale/auth/customers",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(customers.statusCode).toBe(200);
    expect(customers.json().items.length).toBeGreaterThanOrEqual(2);

    const selectA = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_A_ID },
    });
    expect(selectA.statusCode).toBe(200);

    const product = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staffInternal },
      payload: {
        sku: "ACTING-FLOW-SKU",
        name: "Acting flow product",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
        webWholesale: true,
      },
    });
    expect(product.statusCode).toBe(201);
    const productId = product.json().id as string;

    const catalog = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(catalog.statusCode).toBe(200);

    const order = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        lines: [{ productId, qty: 1 }],
      },
    });
    expect(order.statusCode).toBe(201);
    const orderId = order.json().id as string;

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

  it("returns 404 when wholesale buyer fetches another customer's order", async () => {
    const app = await startActingApp();
    const staffInternal = await loginStaffInternal(app);

    const buyerA = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    expect(buyerA.statusCode).toBe(200);
    const buyerACookie = wholesaleCookie(buyerA);

    const buyerB = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "buyer-b@local.test",
        password: "buyer-b-secret",
      },
    });
    expect(buyerB.statusCode).toBe(200);
    const buyerBCookie = wholesaleCookie(buyerB);

    const product = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staffInternal },
      payload: {
        sku: "CROSS-CUSTOMER-SKU",
        name: "Cross customer product",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
        webWholesale: true,
      },
    });
    expect(product.statusCode).toBe(201);
    const productId = product.json().id as string;

    const buyerBOrder = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerBCookie },
      payload: {
        lines: [{ productId, qty: 1 }],
      },
    });
    expect(buyerBOrder.statusCode).toBe(201);
    const buyerBOrderId = buyerBOrder.json().id as string;

    const forbidden = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${buyerBOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerACookie },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });
  });

  it("ignores body customerId on POST sales-orders and uses session customer", async () => {
    const app = await startActingApp();
    const staffInternal = await loginStaffInternal(app);
    const cookie = await loginStaffActing(app);

    const product = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staffInternal },
      payload: {
        sku: "ACTING-SKU",
        name: "Acting product",
        uom: "EA",
        memberPriceCents: 100,
        listPriceCents: 100,
        webWholesale: true,
      },
    });
    expect(product.statusCode).toBe(201);
    const productId = product.json().id as string;

    await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_A_ID },
    });

    const order = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_B_ID,
        lines: [{ productId, qty: 1 }],
      },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json()).toMatchObject({ customerId: CUSTOMER_A_ID });
  });
});
