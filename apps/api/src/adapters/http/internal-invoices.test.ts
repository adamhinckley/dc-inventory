import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  CreateInvoiceUseCase,
  InMemoryAccountingUnitOfWork,
} from "@dc-inventory/accounting";
import {
  CustomerId,
  InvoiceId,
  OrderId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE, WHOLESALE_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startAccountingApp() {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const unitOfWork = new InMemoryUnitOfWork();
  const accountingUow = new InMemoryAccountingUnitOfWork();

  await staffUsers.save({
    id: STAFF_ID,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });

  const createInvoice = new CreateInvoiceUseCase(accountingUow);
  const created = await createInvoice.execute({
    staffUserId: STAFF_ID,
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    subtotalCents: 1000,
    currency: "USD",
  });
  if (!created.ok) {
    throw new Error("expected invoice seed");
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-24T03:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    unitOfWork,
    invoiceRepo: accountingUow.invoices,
    accountingUnitOfWork: accountingUow,
  });
  apps.push(app);
  return { app, invoice: created.invoice };
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: { email: "staff@local.test", password: "staff-secret" },
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal invoices HTTP", () => {
  it("requires staff_session on GET and POST", async () => {
    const { app, invoice } = await startAccountingApp();
    const getResponse = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoice.id}`,
    });
    expect(getResponse.statusCode).toBe(401);

    const postResponse = await app.inject({
      method: "POST",
      url: `/internal/invoices/${invoice.id}/record-payment`,
      payload: {
        amountCents: 100,
        currency: "USD",
        idempotencyKey: "no-auth",
      },
    });
    expect(postResponse.statusCode).toBe(401);
    expect(postResponse.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects wholesale cookie without staff_session", async () => {
    const { app, invoice } = await startAccountingApp();
    const response = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoice.id}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: "fake-wholesale-token" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects invalid record-payment body with Zod", async () => {
    const { app, invoice } = await startAccountingApp();
    const cookie = await staffCookie(app);
    const response = await app.inject({
      method: "POST",
      url: `/internal/invoices/${invoice.id}/record-payment`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { amountCents: 0, currency: "USD", idempotencyKey: "bad" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("reads invoice and maps overpay to 409", async () => {
    const { app, invoice } = await startAccountingApp();
    const cookie = await staffCookie(app);

    const read = await app.inject({
      method: "GET",
      url: `/internal/invoices/${invoice.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(read.statusCode).toBe(200);
    const body = read.json() as {
      documentNumber: string;
      remainingCents: number;
      taxTotalCents: number;
      totalCents: number;
    };
    expect(body.documentNumber).toBe("INV-00001");
    expect(body.taxTotalCents).toBe(0);
    expect(body.totalCents).toBe(1000);
    expect(body.remainingCents).toBe(1000);

    const overpay = await app.inject({
      method: "POST",
      url: `/internal/invoices/${invoice.id}/record-payment`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        amountCents: 1001,
        currency: "USD",
        idempotencyKey: "over",
      },
    });
    expect(overpay.statusCode).toBe(409);
    expect(overpay.json()).toEqual({ error: "overpay" });

    const payment = await app.inject({
      method: "POST",
      url: `/internal/invoices/${invoice.id}/record-payment`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        amountCents: 400,
        currency: "USD",
        idempotencyKey: "partial",
      },
    });
    expect(payment.statusCode).toBe(200);
    expect(payment.json()).toEqual({ remainingCents: 600, currency: "USD" });
  });

  it("returns 404 for unknown invoice id", async () => {
    const { app } = await startAccountingApp();
    const cookie = await staffCookie(app);
    const missing = InvoiceId.parse("99999999-9999-4999-8999-999999999999");
    const response = await app.inject({
      method: "GET",
      url: `/internal/invoices/${missing}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(response.statusCode).toBe(404);
  });
});
