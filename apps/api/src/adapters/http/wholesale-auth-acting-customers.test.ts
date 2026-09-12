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
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const ACTIVE_CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const ON_HOLD_CUSTOMER_ID = CustomerId.parse("44444444-4444-4444-8444-444444444444");
const INACTIVE_CUSTOMER_ID = CustomerId.parse("55555555-5555-4555-8555-555555555555");
const NO_WHOLESALE_CUSTOMER_ID = CustomerId.parse("66666666-6666-4666-8666-666666666666");
const OTHER_ORG_CUSTOMER_ID = CustomerId.parse("99999999-9999-4999-8999-999999999999");
const OTHER_ORG_ID = OrganizationId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const ACME_SLUG = "acme";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startActingCustomersApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG, name: "Acme Wholesale" });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const createdAt = new Date("2026-08-24T03:30:00.000Z");

  await customerRepo.save({
    id: ACTIVE_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Active Wholesale",
    customerNumber: "C-00001",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "active",
    createdAt,
  });
  await customerRepo.save({
    id: ON_HOLD_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "On Hold Wholesale",
    customerNumber: "C-00002",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "on_hold",
    createdAt,
  });
  await customerRepo.save({
    id: INACTIVE_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Inactive Wholesale",
    customerNumber: "C-00003",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "inactive",
    createdAt,
  });
  await customerRepo.save({
    id: NO_WHOLESALE_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "No Wholesale Login",
    customerNumber: "C-00004",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "active",
    createdAt,
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
    customerId: ACTIVE_CUSTOMER_ID,
  });
  await wholesaleUsers.save({
    id: WholesaleUserId.parse("77777777-7777-4777-8777-777777777777"),
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Wholesale User",
    email: "onhold@local.test",
    passwordHash: await passwords.hash("onhold-secret"),
    customerId: ON_HOLD_CUSTOMER_ID,
  });
  await wholesaleUsers.save({
    id: WholesaleUserId.parse("88888888-8888-4888-8888-888888888888"),
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Wholesale User",
    email: "inactive@local.test",
    passwordHash: await passwords.hash("inactive-secret"),
    customerId: INACTIVE_CUSTOMER_ID,
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
  return { app, customerRepo, wholesaleUsers };
}

function cookieValue(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
) {
  return res.cookies.find((cookie) => cookie.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
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
  return cookieValue(login);
}

async function loginBuyer(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: {
      organizationSlug: ACME_SLUG,
      email: "wholesale@local.test",
      password: "wholesale-secret",
    },
  });
  return cookieValue(login);
}

describe("wholesale acting customer picker HTTP", () => {
  it("lists picker customers for staff acting and returns 404 for buyer sessions", async () => {
    const { app } = await startActingCustomersApp();
    const staffCookie = await loginStaffActing(app);
    const buyerCookie = await loginBuyer(app);

    const list = await app.inject({
      method: "GET",
      url: "/wholesale/auth/customers",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      items: [
        {
          customerId: ACTIVE_CUSTOMER_ID,
          businessName: "Active Wholesale",
          customerNumber: "C-00001",
          accountStatus: "active",
        },
        {
          customerId: ON_HOLD_CUSTOMER_ID,
          businessName: "On Hold Wholesale",
          customerNumber: "C-00002",
          accountStatus: "on_hold",
        },
      ],
    });

    const buyerList = await app.inject({
      method: "GET",
      url: "/wholesale/auth/customers",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
    });
    expect(buyerList.statusCode).toBe(404);
    expect(buyerList.json()).toEqual({ error: "not_found" });
  });

  it("does not call resolveWholesale after successful select or clear", async () => {
    const { app } = await startActingCustomersApp();
    const staffCookie = await loginStaffActing(app);
    const resolveSpy = vi.spyOn(app.identity.resolveWholesale, "execute");

    const select = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: ACTIVE_CUSTOMER_ID },
    });
    expect(select.statusCode).toBe(200);
    expect(resolveSpy).toHaveBeenCalledTimes(0);

    const clear = await app.inject({
      method: "POST",
      url: "/wholesale/auth/clear-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
    });
    expect(clear.statusCode).toBe(200);
    expect(resolveSpy).toHaveBeenCalledTimes(0);

    const session = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
    });
    expect(session.statusCode).toBe(200);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it("selects and clears customers for staff acting with expected status codes", async () => {
    const { app } = await startActingCustomersApp();
    const staffCookie = await loginStaffActing(app);

    const selectActive = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: ACTIVE_CUSTOMER_ID },
    });
    expect(selectActive.statusCode).toBe(200);
    expect(selectActive.json()).toMatchObject({
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      customerId: ACTIVE_CUSTOMER_ID,
    });

    const selectOnHold = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: ON_HOLD_CUSTOMER_ID },
    });
    expect(selectOnHold.statusCode).toBe(200);
    expect(selectOnHold.json()).toMatchObject({
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      customerId: ON_HOLD_CUSTOMER_ID,
    });

    const session = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({
      mode: "staff_acting",
      customerId: ON_HOLD_CUSTOMER_ID,
    });

    const selectInactive = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: INACTIVE_CUSTOMER_ID },
    });
    expect(selectInactive.statusCode).toBe(409);
    expect(selectInactive.json()).toEqual({ error: "conflict" });

    const selectMissing = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: NO_WHOLESALE_CUSTOMER_ID },
    });
    expect(selectMissing.statusCode).toBe(404);
    expect(selectMissing.json()).toEqual({ error: "not_found" });

    const clear = await app.inject({
      method: "POST",
      url: "/wholesale/auth/clear-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
    });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toMatchObject({
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      customerId: null,
    });
  });

  it("returns 404 when selecting a customer from another organization", async () => {
    const { app, customerRepo, wholesaleUsers } = await startActingCustomersApp();
    const createdAt = new Date("2026-08-24T03:30:00.000Z");
    await customerRepo.save({
      id: OTHER_ORG_CUSTOMER_ID,
      organizationId: OTHER_ORG_ID,
      name: "Other Org Customer",
      customerNumber: "C-00099",
      creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
      terms: "NET30",
      accountStatus: "active",
      createdAt,
    });
    await wholesaleUsers.save({
      id: WholesaleUserId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab"),
      organizationId: OTHER_ORG_ID,
      displayName: "Test Wholesale User",
      email: "other-org@local.test",
      passwordHash: "hash",
      customerId: OTHER_ORG_CUSTOMER_ID,
    });
    const staffCookie = await loginStaffActing(app);

    const select = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: staffCookie },
      payload: { customerId: OTHER_ORG_CUSTOMER_ID },
    });

    expect(select.statusCode).toBe(404);
    expect(select.json()).toEqual({ error: "not_found" });
  });

  it("returns 404 for buyer select and clear", async () => {
    const { app } = await startActingCustomersApp();
    const buyerCookie = await loginBuyer(app);

    const select = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
      payload: { customerId: ACTIVE_CUSTOMER_ID },
    });
    const clear = await app.inject({
      method: "POST",
      url: "/wholesale/auth/clear-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: buyerCookie },
    });

    expect(select.statusCode).toBe(404);
    expect(select.json()).toEqual({ error: "not_found" });
    expect(clear.statusCode).toBe(404);
    expect(clear.json()).toEqual({ error: "not_found" });
  });
});
