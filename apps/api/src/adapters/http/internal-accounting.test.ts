import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  CreateInvoiceUseCase,
  InMemoryAccountingUnitOfWork,
  PaymentId,
  RecordCustomerPaymentUseCase,
} from "@dc-inventory/accounting";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { testShipAccountingReadPorts } from "../../adapters/test-ship-accounting-readports.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const OTHER_CUSTOMER_ID = CustomerId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const ORDER_ID = OrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
const SECOND_ORDER_ID = OrderId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
const THIRD_ORDER_ID = OrderId.parse("ffffffff-ffff-4fff-8fff-ffffffffffff");
const AS_OF = new Date("2026-09-09T00:00:00.000Z");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startAccountingApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const customers = new InMemoryCustomerRepository();
  const shipPorts = testShipAccountingReadPorts();
  const unitOfWork = new InMemoryUnitOfWork(shipPorts.billToSnapshot, shipPorts.customerTerms);
  const accountingUow = new InMemoryAccountingUnitOfWork();
  const clock = new InMemoryClock(AS_OF);

  await staffUsers.save({
    id: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  await customers.save({
    id: CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "AR Customer",
    customerNumber: "100001",
    creditLimit: Money.fromMinorUnits(50_000, "USD"),
    terms: "Net 30",
    taxId: null,
    accountStatus: "active",
    customerNote: null,
    staffNote: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  });
  await customers.save({
    id: OTHER_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Other Customer",
    customerNumber: "100002",
    creditLimit: Money.fromMinorUnits(10_000, "USD"),
    terms: "Net 30",
    taxId: null,
    accountStatus: "active",
    customerNote: null,
    staffNote: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  });

  const createInvoice = new CreateInvoiceUseCase(
    accountingUow,
    shipPorts.billToSnapshot,
    shipPorts.customerTerms,
    clock,
  );
  const openInvoice = await createInvoice.execute({
    staffUserId: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    subtotalCents: 1000,
    currency: "USD",
  });
  const paidInvoice = await createInvoice.execute({
    staffUserId: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    orderId: SECOND_ORDER_ID,
    customerId: CUSTOMER_ID,
    subtotalCents: 500,
    currency: "USD",
  });
  const eurInvoice = await createInvoice.execute({
    staffUserId: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    orderId: THIRD_ORDER_ID,
    customerId: CUSTOMER_ID,
    subtotalCents: 300,
    currency: "EUR",
  });
  if (!openInvoice.ok || !paidInvoice.ok || !eurInvoice.ok) {
    throw new Error("expected invoice seed");
  }

  const recordPayment = new RecordCustomerPaymentUseCase(accountingUow, clock);
  const paidOff = await recordPayment.execute({
    staffUserId: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    customerId: CUSTOMER_ID,
    amountCents: 500,
    currency: "USD",
    method: "check",
    idempotencyKey: "seed-paid-invoice",
    holdRemainderAsCredit: false,
    applications: [{ invoiceId: paidInvoice.invoice.id, amountCents: 500 }],
  });
  if (!paidOff.ok) {
    throw new Error("expected paid invoice seed");
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock,
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    customerRepo: customers,
    unitOfWork,
    invoiceRepo: accountingUow.invoices,
    accountingUnitOfWork: accountingUow,
  });
  apps.push(app);
  return {
    app,
    openInvoice: openInvoice.invoice,
    paidInvoice: paidInvoice.invoice,
    eurInvoice: eurInvoice.invoice,
  };
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

describe("internal accounting HTTP", () => {
  it("reads customer accounting summary and invoice/payment lists", async () => {
    const { app, openInvoice, paidInvoice } = await startAccountingApp();
    const cookie = await staffCookie(app);

    const summary = await app.inject({
      method: "GET",
      url: `/internal/customers/${CUSTOMER_ID}/accounting?asOf=${AS_OF.toISOString()}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({
      openBalanceOwedCents: 1300,
      stats: { openInvoiceCount: 2 },
    });

    const invoices = await app.inject({
      method: "GET",
      url: `/internal/customers/${CUSTOMER_ID}/invoices?asOf=${AS_OF.toISOString()}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(invoices.statusCode).toBe(200);
    expect(invoices.json().items).toHaveLength(2);
    expect(invoices.json().items.map((row: { id: string }) => row.id)).toContain(openInvoice.id);

    const withPaid = await app.inject({
      method: "GET",
      url: `/internal/customers/${CUSTOMER_ID}/invoices?includePaid=true&asOf=${AS_OF.toISOString()}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(withPaid.statusCode).toBe(200);
    const paidIds = withPaid.json().items.map((row: { id: string }) => row.id);
    expect(withPaid.json().items).toHaveLength(3);
    expect(paidIds).toContain(openInvoice.id);
    expect(paidIds).toContain(paidInvoice.id);

    const payments = await app.inject({
      method: "GET",
      url: `/internal/customers/${CUSTOMER_ID}/payments?asOf=${AS_OF.toISOString()}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(payments.statusCode).toBe(200);
    expect(payments.json().items).toHaveLength(1);
  });

  it("returns 404 for unknown customer accounting routes", async () => {
    const { app } = await startAccountingApp();
    const cookie = await staffCookie(app);
    const missing = CustomerId.parse("99999999-9999-4999-8999-999999999999");
    const response = await app.inject({
      method: "GET",
      url: `/internal/customers/${missing}/accounting`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it("records customer payment with success and error mapping", async () => {
    const { app, openInvoice, paidInvoice } = await startAccountingApp();
    const cookie = await staffCookie(app);
    const base = {
      method: "POST" as const,
      url: `/internal/customers/${CUSTOMER_ID}/payments`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    };

    const invalid = await app.inject({
      ...base,
      payload: {
        amountCents: 100,
        currency: "USD",
        method: "check",
        idempotencyKey: "invalid-no-hold",
        holdRemainderAsCredit: false,
        applications: [],
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "invalid" });

    const overpay = await app.inject({
      ...base,
      payload: {
        amountCents: 2000,
        currency: "USD",
        method: "check",
        idempotencyKey: "overpay",
        holdRemainderAsCredit: false,
        applications: [{ invoiceId: openInvoice.id, amountCents: 2000 }],
      },
    });
    expect(overpay.statusCode).toBe(409);
    expect(overpay.json()).toEqual({ error: "overpay" });

    const notFound = await app.inject({
      ...base,
      payload: {
        amountCents: 100,
        currency: "USD",
        method: "check",
        idempotencyKey: "missing-invoice",
        holdRemainderAsCredit: false,
        applications: [
          {
            invoiceId: InvoiceId.parse("99999999-9999-4999-8999-999999999999"),
            amountCents: 100,
          },
        ],
      },
    });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json()).toEqual({ error: "not_found" });

    const wrongCurrency = await app.inject({
      ...base,
      payload: {
        amountCents: 100,
        currency: "EUR",
        method: "check",
        idempotencyKey: "wrong-currency",
        holdRemainderAsCredit: false,
        applications: [{ invoiceId: openInvoice.id, amountCents: 100 }],
      },
    });
    expect(wrongCurrency.statusCode).toBe(400);
    expect(wrongCurrency.json()).toEqual({ error: "wrong_currency" });

    const success = await app.inject({
      ...base,
      payload: {
        amountCents: 400,
        currency: "USD",
        method: "check",
        reference: "1001",
        idempotencyKey: "customer-payment",
        holdRemainderAsCredit: false,
        applications: [{ invoiceId: openInvoice.id, amountCents: 400 }],
      },
    });
    expect(success.statusCode).toBe(200);
    expect(success.json()).toMatchObject({
      unappliedCents: 0,
      remainingByInvoiceId: { [openInvoice.id]: 600 },
    });

    const conflict = await app.inject({
      ...base,
      payload: {
        amountCents: 300,
        currency: "USD",
        method: "check",
        idempotencyKey: "customer-payment",
        holdRemainderAsCredit: false,
        applications: [{ invoiceId: openInvoice.id, amountCents: 300 }],
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ error: "conflict" });
  });

  it("reallocates, voids, and adjusts with error mapping", async () => {
    const { app, openInvoice, eurInvoice } = await startAccountingApp();
    const cookie = await staffCookie(app);

    const payment = await app.inject({
      method: "POST",
      url: `/internal/customers/${CUSTOMER_ID}/payments`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        amountCents: 600,
        currency: "USD",
        method: "ach",
        idempotencyKey: "reallocate-seed",
        holdRemainderAsCredit: true,
        applications: [{ invoiceId: openInvoice.id, amountCents: 400 }],
      },
    });
    expect(payment.statusCode).toBe(200);
    const paymentId = payment.json().paymentId as string;
    expect(paymentId).toMatch(/^[0-9a-f-]{36}$/i);

    const invalidReallocate = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/reallocate`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { applications: [] },
    });
    expect(invalidReallocate.statusCode).toBe(400);

    const invalidReallocateAmount = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/reallocate`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        applications: [{ invoiceId: openInvoice.id, deltaCents: 5000 }],
      },
    });
    expect(invalidReallocateAmount.statusCode).toBe(409);
    expect(invalidReallocateAmount.json()).toEqual({ error: "overpay" });

    const reallocate = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/reallocate`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        applications: [{ invoiceId: openInvoice.id, deltaCents: 200 }],
      },
    });
    expect(reallocate.statusCode).toBe(200);
    expect(reallocate.json()).toMatchObject({ unappliedCents: 0 });

    const wrongCurrencyReallocate = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/reallocate`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        applications: [{ invoiceId: eurInvoice.id, deltaCents: 100 }],
      },
    });
    expect(wrongCurrencyReallocate.statusCode).toBe(400);
    expect(wrongCurrencyReallocate.json()).toEqual({ error: "wrong_currency" });

    const invalidAdjust = await app.inject({
      method: "POST",
      url: `/internal/invoices/${openInvoice.id}/adjustments`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        kind: "credit_memo",
        amountCents: 0,
        reason: "bad",
      },
    });
    expect(invalidAdjust.statusCode).toBe(400);

    const adjust = await app.inject({
      method: "POST",
      url: `/internal/invoices/${openInvoice.id}/adjustments`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        kind: "credit_memo",
        amountCents: 100,
        reason: "goodwill",
      },
    });
    expect(adjust.statusCode).toBe(200);
    expect(adjust.json()).toEqual({ remainingCents: 300 });

    const missingAdjust = await app.inject({
      method: "POST",
      url: `/internal/invoices/${InvoiceId.parse("99999999-9999-4999-8999-999999999999")}/adjustments`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        kind: "credit_memo",
        amountCents: 50,
        reason: "missing",
      },
    });
    expect(missingAdjust.statusCode).toBe(404);

    const invalidVoid = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/void`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { voidReason: "   " },
    });
    expect(invalidVoid.statusCode).toBe(400);
    expect(invalidVoid.json()).toEqual({ error: "invalid" });

    const voidPayment = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/void`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { voidReason: "entered in error" },
    });
    expect(voidPayment.statusCode).toBe(200);
    expect(voidPayment.json()).toEqual({ unappliedCents: 0 });

    const voidConflict = await app.inject({
      method: "POST",
      url: `/internal/payments/${paymentId}/void`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { voidReason: "again" },
    });
    expect(voidConflict.statusCode).toBe(409);
    expect(voidConflict.json()).toEqual({ error: "conflict" });

    const missingReallocate = await app.inject({
      method: "POST",
      url: `/internal/payments/${PaymentId.parse("99999999-9999-4999-8999-999999999999")}/reallocate`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        applications: [{ invoiceId: openInvoice.id, deltaCents: 100 }],
      },
    });
    expect(missingReallocate.statusCode).toBe(404);

    const missingVoid = await app.inject({
      method: "POST",
      url: `/internal/payments/${PaymentId.parse("99999999-9999-4999-8999-999999999999")}/void`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { voidReason: "missing payment" },
    });
    expect(missingVoid.statusCode).toBe(404);
    expect(missingVoid.json()).toEqual({ error: "not_found" });
  });

  it("manages payment plans with success and error mapping", async () => {
    const { app } = await startAccountingApp();
    const cookie = await staffCookie(app);

    const invalid = await app.inject({
      method: "PUT",
      url: `/internal/customers/${CUSTOMER_ID}/payment-plan`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        frequency: "monthly",
        installmentAmountCents: 0,
        currency: "USD",
        startsOn: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(invalid.statusCode).toBe(400);

    const created = await app.inject({
      method: "PUT",
      url: `/internal/customers/${CUSTOMER_ID}/payment-plan`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        frequency: "monthly",
        installmentAmountCents: 500,
        currency: "USD",
        startsOn: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      frequency: "monthly",
      installmentAmountCents: 500,
    });

    const conflict = await app.inject({
      method: "PUT",
      url: `/internal/customers/${CUSTOMER_ID}/payment-plan`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        frequency: "weekly",
        installmentAmountCents: 250,
        currency: "USD",
        startsOn: "2026-09-08T00:00:00.000Z",
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ error: "conflict" });

    const ended = await app.inject({
      method: "DELETE",
      url: `/internal/customers/${CUSTOMER_ID}/payment-plan`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(ended.statusCode).toBe(204);

    const missingPlan = await app.inject({
      method: "DELETE",
      url: `/internal/customers/${CUSTOMER_ID}/payment-plan`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(missingPlan.statusCode).toBe(404);
  });

  it("serves business-wide accounting summary and x-table lists", async () => {
    const { app } = await startAccountingApp();
    const cookie = await staffCookie(app);

    const summary = await app.inject({
      method: "GET",
      url: `/internal/accounting/summary?asOf=${AS_OF.toISOString()}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({
      totalOpenArCents: 1300,
      aging: { current: 1300 },
    });

    const balances = await app.inject({
      method: "GET",
      url: `/internal/accounting/customer-balances?asOf=${AS_OF.toISOString()}&page=1&pageSize=25`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(balances.statusCode).toBe(200);
    expect(balances.json().items.length).toBeGreaterThan(0);

    const badAsOf = await app.inject({
      method: "GET",
      url: "/internal/accounting/customer-balances?asOf=not-a-date&page=1&pageSize=25",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(badAsOf.statusCode).toBe(400);

    const payments = await app.inject({
      method: "GET",
      url: `/internal/accounting/payments?from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z&page=1&pageSize=25`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(payments.statusCode).toBe(200);
    expect(payments.json()).toMatchObject({ total: 1, page: 1, pageSize: 25 });
  });
});
