import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import { CustomerId, LocationId, Money, OrderId, OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { CustomerBillToSnapshotReadAdapter } from "@dc-inventory/customers";
import { CustomerTermsReadAdapter } from "@dc-inventory/accounting";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";
import { InMemoryCustomerRepository, InMemoryBillToRepository } from "@dc-inventory/customers";
import { InMemoryProductRepository } from "@dc-inventory/catalog";
import { ProductId } from "@dc-inventory/shared-kernel";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU = Sku.parse("HEX-BOLT-GALV");
const PRODUCT_ID = ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSalesApp(options: { productInactive?: boolean } = {}) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const billToRepo = new InMemoryBillToRepository();
  const productRepo = new InMemoryProductRepository();
  const billToSnapshot = new CustomerBillToSnapshotReadAdapter(customerRepo, billToRepo);
  const customerTerms = new CustomerTermsReadAdapter(customerRepo);
  const unitOfWork = new InMemoryUnitOfWork(billToSnapshot, customerTerms);

  await customerRepo.save({
    id: CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Acme Wholesale",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "Net 30",
    createdAt: new Date("2026-08-24T03:30:00.000Z"),
  });
  await billToRepo.save({
    customerId: CUSTOMER_ID,
    line1: "100 Main St",
    line2: null,
    city: "Portland",
    region: "OR",
    postal: "97201",
    country: "US",
  });
  await productRepo.save({
    id: PRODUCT_ID,
    organizationId: OrganizationId.DEFAULT,
    sku: SKU,
    name: "Catalog hex bolt",
    description: null,
    uom: "EA",
    memberPrice: Money.fromMinorUnits(250, "USD"),
    listPrice: Money.fromMinorUnits(250, "USD"),
    inactive: options.productInactive ?? false,
    discontinued: false,
    webWholesale: true,
    taxCategoryCode: "TANGIBLE",
  });

  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-24T03:30:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    unitOfWork,
    customerRepo,
    billToRepo,
    productRepo,
    salesOrderRepo: unitOfWork.salesOrders,
  });
  apps.push(app);
  return { app, unitOfWork };
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal sales orders HTTP", () => {
  it("requires staff_session", async () => {
    const { app } = await startSalesApp();
    const response = await app.inject({ method: "GET", url: "/internal/sales-orders" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects invalid create body with Zod", async () => {
    const { app } = await startSalesApp();
    const cookie = await staffCookie(app);
    const response = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_ID, lines: [] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("returns the declared conflict response for an inactive product", async () => {
    const { app } = await startSalesApp({ productInactive: true });
    const cookie = await staffCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [{ productId: PRODUCT_ID, qty: 1 }],
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "conflict" });
  });

  it("runs create, confirm, ship, and cancel", async () => {
    const { app, unitOfWork } = await startSalesApp();
    const cookie = await staffCookie(app);

    await unitOfWork.run(async (scope) => {
      const result = await new RecordAdjustmentIncreaseUseCase(scope.inventory.ledger).execute({
        organizationId: OrganizationId.DEFAULT,
        idempotencyKey: "http-seed-stock",
        sku: SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "http-seed",
      });
      expect(result.ok).toBe(true);
    });

    const created = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [
          {
            productId: PRODUCT_ID,
            qty: 5,
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const order = created.json() as {
      id: string;
      documentNumber: string;
      lines: Array<{
        sku: string;
        name: string;
        unitPriceCents: number;
        currency: string;
        taxCategoryCode: string;
      }>;
    };
    expect(order.documentNumber).toBe("SO-00001");
    expect(order.lines).toMatchObject([
      {
        sku: SKU.value,
        name: "Catalog hex bolt",
        unitPriceCents: 250,
        currency: "USD",
        taxCategoryCode: "TANGIBLE",
      },
    ]);

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-confirm" },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ status: "confirmed" });

    const shipped = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/ship`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-ship" },
    });
    expect(shipped.statusCode).toBe(200);
    expect(shipped.json()).toMatchObject({ status: "shipped" });

    const invoice = await unitOfWork.invoices.findByOrderId(
      OrganizationId.DEFAULT,
      OrderId.parse(order.id),
    );
    expect(invoice).not.toBeNull();
    if (invoice === null) {
      return;
    }

    const invoiceRead = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoice.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(invoiceRead.statusCode).toBe(200);
    expect(invoiceRead.json()).toMatchObject({
      documentNumber: "INV-00001",
      taxTotalCents: 0,
      totalCents: 1250,
    });

    const cancelled = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/cancel`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-cancel" },
    });
    expect(cancelled.statusCode).toBe(409);
  });

  it("rejects ship without staff_session", async () => {
    const { app } = await startSalesApp();
    const response = await app.inject({
      method: "POST",
      url: "/internal/sales-orders/11111111-1111-4111-8111-111111111111/ship",
      payload: { idempotencyKey: "no-auth" },
    });
    expect(response.statusCode).toBe(401);
  });
});
