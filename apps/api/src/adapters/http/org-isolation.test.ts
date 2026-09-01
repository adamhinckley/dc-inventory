import {
  CreateProductUseCase,
  InMemoryProductRepository,
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
import {
  RecordAdjustmentIncreaseUseCase,
  RecordAllocatedUseCase,
} from "@dc-inventory/inventory";
import { InMemoryLicensingStore } from "@dc-inventory/licensing";
import {
  CustomerId,
  LocationId,
  Money,
  OrganizationId,
  Sku,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const ACME_SLUG = "acme";
const BETA_SLUG = "beta";
const WIDGET_SKU = Sku.parse("WIDGET-1");

const ACME_STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const BETA_STAFF_ID = StaffUserId.parse("22222222-2222-4222-8222-222222222222");
const ACME_WHOLESALE_ID = WholesaleUserId.parse("33333333-3333-4333-8333-333333333333");
const BETA_WHOLESALE_ID = WholesaleUserId.parse("44444444-4444-4444-8444-444444444444");
const ACME_CUSTOMER_ID = CustomerId.parse("55555555-5555-4555-8555-555555555555");
const BETA_CUSTOMER_ID = CustomerId.parse("66666666-6666-4666-8666-666666666666");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startTwoOrgIsolationApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: DEFAULT_ORG, slug: ACME_SLUG });
  await organizations.save({ id: BETA_ORG, slug: BETA_SLUG });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const productRepo = new InMemoryProductRepository();
  const unitOfWork = new InMemoryUnitOfWork();
  const licensingStore = new InMemoryLicensingStore();
  const clock = new InMemoryClock(new Date("2026-08-27T00:00:00.000Z"));

  await staffUsers.save({
    id: ACME_STAFF_ID,
    organizationId: DEFAULT_ORG,
    email: "acme-staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });
  await staffUsers.save({
    id: BETA_STAFF_ID,
    organizationId: BETA_ORG,
    email: "beta-staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  await customerRepo.save({
    id: ACME_CUSTOMER_ID,
    organizationId: DEFAULT_ORG,
    name: "Acme Wholesale",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    createdAt: new Date("2026-08-24T03:30:00.000Z"),
  });
  await customerRepo.save({
    id: BETA_CUSTOMER_ID,
    organizationId: BETA_ORG,
    name: "Beta Wholesale",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    createdAt: new Date("2026-08-24T03:30:00.000Z"),
  });

  await wholesaleUsers.save({
    id: ACME_WHOLESALE_ID,
    organizationId: DEFAULT_ORG,
    email: "acme-shop@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: ACME_CUSTOMER_ID,
  });
  await wholesaleUsers.save({
    id: BETA_WHOLESALE_ID,
    organizationId: BETA_ORG,
    email: "beta-shop@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: BETA_CUSTOMER_ID,
  });

  const createProduct = new CreateProductUseCase(productRepo);
  const acmeWidget = await createProduct.execute({
    organizationId: DEFAULT_ORG,
    staffUserId: ACME_STAFF_ID,
    sku: WIDGET_SKU.value,
    name: "Acme widget",
    uom: "EA",
    masterPackPrice: 1000,
    currency: "USD",
    webWholesale: true,
  });
  const betaWidget = await createProduct.execute({
    organizationId: BETA_ORG,
    staffUserId: BETA_STAFF_ID,
    sku: WIDGET_SKU.value,
    name: "Beta widget",
    uom: "EA",
    masterPackPrice: 2000,
    currency: "USD",
    webWholesale: true,
  });
  if (!acmeWidget.ok || !betaWidget.ok) {
    throw new Error("expected product seed");
  }

  const adjustmentIncrease = new RecordAdjustmentIncreaseUseCase(unitOfWork.inventory.ledger);
  const allocated = new RecordAllocatedUseCase(unitOfWork.inventory.ledger);

  await adjustmentIncrease.execute({
    organizationId: DEFAULT_ORG,
    sku: WIDGET_SKU,
    locationId: LocationId.DEFAULT,
    quantity: 10,
    idempotencyKey: "acme-widget-receive",
    refType: "adjustment",
    refId: "acme-widget-receive",
  });
  await allocated.execute({
    organizationId: DEFAULT_ORG,
    sku: WIDGET_SKU,
    locationId: LocationId.DEFAULT,
    quantity: 4,
    idempotencyKey: "acme-widget-alloc",
    refType: "sales_order",
    refId: "acme-so-1",
  });

  await adjustmentIncrease.execute({
    organizationId: BETA_ORG,
    sku: WIDGET_SKU,
    locationId: LocationId.DEFAULT,
    quantity: 99,
    idempotencyKey: "beta-widget-receive",
    refType: "adjustment",
    refId: "beta-widget-receive",
  });

  const acmeSubscription = licensingStore.createSubscription(DEFAULT_ORG, "enterprise");
  licensingStore.recordPayment(DEFAULT_ORG, acmeSubscription.id, "pi_acme_sub");
  const betaSubscription = licensingStore.createSubscription(BETA_ORG, "starter");
  licensingStore.recordPayment(BETA_ORG, betaSubscription.id, "pi_beta_sub");

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock,
    staffUsers,
    wholesaleUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    customerRepo,
    productRepo,
    unitOfWork,
    licensingStore,
  });
  apps.push(app);

  return {
    app,
    acmeWidgetId: acmeWidget.product.id,
    betaWidgetId: betaWidget.product.id,
    productRepo,
  };
}

async function loginStaff(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  organizationSlug = ACME_SLUG,
): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: { organizationSlug, email, password: "staff-secret" },
  });
  return login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE)?.value ?? "";
}

async function loginWholesale(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  organizationSlug = ACME_SLUG,
): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/wholesale/auth/login",
    payload: { organizationSlug, email, password: "wholesale-secret" },
  });
  return login.cookies.find((row) => row.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

describe("two-org HTTP isolation (ADA-169)", () => {
  it("scopes Acme staff product list away from Beta's WIDGET-1", async () => {
    const { app } = await startTwoOrgIsolationApp();
    const cookie = await loginStaff(app, "acme-staff@local.test");

    const listed = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as {
      total: number;
      items: Array<{ sku: string; name: string }>;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ sku: "WIDGET-1", name: "Acme widget" });
    expect(body.items.some((row) => row.name === "Beta widget")).toBe(false);
  });

  it("returns Acme warehouse available, not Beta's, for the shared SKU", async () => {
    const { app } = await startTwoOrgIsolationApp();
    const cookie = await loginStaff(app, "acme-staff@local.test");

    const listed = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as {
      items: Array<{ available: number; onHand: number; allocated: number }>;
    };
    expect(body.items[0]).toMatchObject({
      onHand: 10,
      allocated: 4,
      available: 6,
    });
  });

  it("keeps Acme wholesale catalog and product detail inside Acme", async () => {
    const { app, betaWidgetId } = await startTwoOrgIsolationApp();
    const cookie = await loginWholesale(app, "acme-shop@local.test");

    const listed = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      total: 1,
      items: [{ name: "Acme widget", available: 6 }],
    });

    const betaDetail = await app.inject({
      method: "GET",
      url: `/wholesale/catalog/${betaWidgetId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(betaDetail.statusCode).toBe(404);
    expect(betaDetail.json()).toEqual({ error: "not_found" });
  });

  it("ignores spoofed organizationId on wholesale catalog query", async () => {
    const { app } = await startTwoOrgIsolationApp();
    const cookie = await loginWholesale(app, "acme-shop@local.test");

    const listed = await app.inject({
      method: "GET",
      url: `/wholesale/catalog?organizationId=${BETA_ORG}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      total: 1,
      items: [{ name: "Acme widget" }],
    });
  });

  it("scopes licensing subscription and payment history to the staff session org", async () => {
    const { app } = await startTwoOrgIsolationApp();
    const cookie = await loginStaff(app, "acme-staff@local.test");

    const subscriptions = await app.inject({
      method: "GET",
      url: "/internal/licensing/subscriptions",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(subscriptions.statusCode).toBe(200);
    expect(subscriptions.json().items).toHaveLength(1);
    expect(subscriptions.json().items[0]).toMatchObject({
      plan: "enterprise",
      status: "active",
    });

    const payments = await app.inject({
      method: "GET",
      url: "/internal/licensing/payments",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(payments.statusCode).toBe(200);
    expect(payments.json()).toMatchObject({
      items: [{ providerRef: "pi_acme_sub", amountCents: 1000 }],
    });
    expect(
      (payments.json() as { items: Array<{ providerRef: string }> }).items.some(
        (row) => row.providerRef === "pi_beta_sub",
      ),
    ).toBe(false);
  });

  it("ignores spoofed organizationId in staff product create body", async () => {
    const { app, productRepo, cookie } = await startTwoOrgIsolationApp().then(async (seed) => ({
      ...seed,
      cookie: await loginStaff(seed.app, "acme-staff@local.test"),
    }));

    const created = await app.inject({
      method: "POST",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        organizationId: BETA_ORG,
        sku: "ACME-ONLY-SKU",
        name: "Acme-only product",
        uom: "EA",
        masterPackPrice: 500,
        webWholesale: true,
      },
    });
    expect(created.statusCode).toBe(201);

    const betaProducts = await productRepo.listMatching({ organizationId: BETA_ORG });
    expect(
      betaProducts.some((row) => row.product.sku.value === "ACME-ONLY-SKU"),
    ).toBe(false);

    const acmeListed = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(acmeListed.json().total).toBe(2);
    expect(
      (acmeListed.json() as { items: Array<{ sku: string }> }).items.some(
        (row) => row.sku === "ACME-ONLY-SKU",
      ),
    ).toBe(true);
  });
});
