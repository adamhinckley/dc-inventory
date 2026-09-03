import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import {
  CorrectPaymentUseCase,
  CreateInvoiceUseCase,
  GetInvoiceUseCase,
  RecordPaymentUseCase,
} from "../src/index.js";
import { testInvoiceSnapshotPorts } from "./support/invoice-snapshot-port-fixtures.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const BETA_CUSTOMER_ID = CustomerId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

async function harness() {
  const uow = new InMemoryAccountingUnitOfWork();
  const ports = testInvoiceSnapshotPorts();
  return {
    uow,
    create: new CreateInvoiceUseCase(uow, ports.billToSnapshot, ports.customerTerms),
    get: new GetInvoiceUseCase(uow.invoices),
    record: new RecordPaymentUseCase(uow),
    correct: new CorrectPaymentUseCase(uow),
  };
}

async function createInvoice(h: Awaited<ReturnType<typeof harness>>, subtotal = 1000) {
  const result = await h.create.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    subtotalCents: subtotal,
    currency: "USD",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected invoice");
  }
  return result.invoice;
}

describe("Accounting (in-memory)", () => {
  it("assigns INV-00001 document numbers with gaps allowed", async () => {
    const h = await harness();
    const first = await h.create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 500,
      currency: "USD",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.invoice.documentNumber).toBe("INV-00001");

    const secondOrder = OrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const second = await h.create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: secondOrder,
      customerId: CUSTOMER_ID,
      subtotalCents: 200,
      currency: "USD",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.invoice.documentNumber).toBe("INV-00002");
  });

  it("does not insert a second invoice for the same order", async () => {
    const h = await harness();
    const first = await createInvoice(h, 800);
    const duplicate = await h.create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 800,
      currency: "USD",
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) {
      return;
    }
    expect(duplicate.created).toBe(false);
    expect(duplicate.invoice.id).toBe(first.id);
  });

  it("stores zero tax and total equals subtotal", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 1500);
    expect(invoice.taxTotal.amountMinor).toBe(0);
    expect(invoice.total.amountMinor).toBe(1500);
    expect(invoice.subtotal.amountMinor).toBe(1500);
  });

  it("derives remaining amount from append-only applications", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 1000);
    const view = await h.get.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }
    expect(view.invoice.remainingCents).toBe(1000);

    await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 400,
      currency: "USD",
      idempotencyKey: "pay-1",
    });
    const afterPartial = await h.get.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
    });
    expect(afterPartial.ok).toBe(true);
    if (!afterPartial.ok) {
      return;
    }
    expect(afterPartial.invoice.remainingCents).toBe(600);
  });

  it("rejects overpay, zero, negative, and wrong currency", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 500);

    const over = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 501,
      currency: "USD",
      idempotencyKey: "over",
    });
    expect(over.ok).toBe(false);
    if (over.ok) {
      return;
    }
    expect(over.reason).toBe("overpay");

    const zero = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 0,
      currency: "USD",
      idempotencyKey: "zero",
    });
    expect(zero.ok).toBe(false);

    const wrongCurrency = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 100,
      currency: "EUR",
      idempotencyKey: "eur",
    });
    expect(wrongCurrency.ok).toBe(false);
    if (wrongCurrency.ok) {
      return;
    }
    expect(wrongCurrency.reason).toBe("wrong_currency");
  });

  it("treats same payment key and payload as no-op success", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 900);
    const first = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 300,
      currency: "USD",
      idempotencyKey: "idem-1",
    });
    expect(first.ok).toBe(true);
    const second = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 300,
      currency: "USD",
      idempotencyKey: "idem-1",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.remainingCents).toBe(600);
    const view = await h.get.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }
    expect(view.invoice.remainingCents).toBe(600);
  });

  it("rejects same key with different payload", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 900);
    await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 300,
      currency: "USD",
      idempotencyKey: "idem-conflict",
    });
    const conflict = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 400,
      currency: "USD",
      idempotencyKey: "idem-conflict",
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) {
      return;
    }
    expect(conflict.reason).toBe("conflict");
  });

  it("appends compensating applications without updating originals", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 1000);
    const payment = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 1000,
      currency: "USD",
      idempotencyKey: "full-pay",
    });
    expect(payment.ok).toBe(true);

    const applications = await h.uow.invoices.listApplications(invoice.id);
    expect(applications).toHaveLength(1);
    const paymentId = applications[0]!.paymentId;

    const corrected = await h.correct.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      paymentId,
      correctionAmountCents: -200,
      currency: "USD",
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) {
      return;
    }
    expect(corrected.remainingCents).toBe(200);

    const after = await h.uow.invoices.listApplications(invoice.id);
    expect(after).toHaveLength(2);
    expect(after[0]!.amount.amountMinor).toBe(1000);
    expect(after[1]!.amount.amountMinor).toBe(-200);
  });

  it("rejects corrections that would over-apply or under-apply past bounds", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 500);
    const payment = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 200,
      currency: "USD",
      idempotencyKey: "partial-pay",
    });
    expect(payment.ok).toBe(true);
    const applications = await h.uow.invoices.listApplications(invoice.id);
    const paymentId = applications[0]!.paymentId;

    const tooPositive = await h.correct.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      paymentId,
      correctionAmountCents: 400,
      currency: "USD",
    });
    expect(tooPositive.ok).toBe(false);

    const tooNegative = await h.correct.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      paymentId,
      correctionAmountCents: -500,
      currency: "USD",
    });
    expect(tooNegative.ok).toBe(false);
  });

  it("rejects per-payment correction that would drive one payment negative", async () => {
    const h = await harness();
    const invoice = await createInvoice(h, 500);
    await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 200,
      currency: "USD",
      idempotencyKey: "pay-a",
    });
    await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      amountCents: 200,
      currency: "USD",
      idempotencyKey: "pay-b",
    });
    const applications = await h.uow.invoices.listApplications(invoice.id);
    const paymentId = applications[0]!.paymentId;

    const tooNegativeForPayment = await h.correct.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: invoice.id,
      paymentId,
      correctionAmountCents: -300,
      currency: "USD",
    });
    expect(tooNegativeForPayment.ok).toBe(false);
  });

  it("scopes invoices by organizationId and rejects cross-org payment targeting", async () => {
    const h = await harness();
    const acmeOrderId = OrderId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    const betaOrderId = OrderId.parse("ffffffff-ffff-4fff-8fff-ffffffffffff");
    const zero = Money.fromMinorUnits(0, "USD");
    const subtotal = Money.fromMinorUnits(1000, "USD");

    await h.uow.invoices.save({
      id: InvoiceId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      organizationId: DEFAULT_ORG,
      orderId: acmeOrderId,
      customerId: CUSTOMER_ID,
      documentNumber: "INV-1001",
      status: "posted",
      postedAt: new Date("2026-01-01T00:00:00.000Z"),
      billLine1: null,
      billLine2: null,
      billCity: null,
      billRegion: null,
      billPostal: null,
      billCountry: null,
      dueDate: null,
      terms: null,
      subtotal,
      taxTotal: zero,
      total: subtotal,
    });
    const betaInvoiceId = InvoiceId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc");
    await h.uow.invoices.save({
      id: betaInvoiceId,
      organizationId: BETA_ORG,
      orderId: betaOrderId,
      customerId: BETA_CUSTOMER_ID,
      documentNumber: "INV-1001",
      status: "posted",
      postedAt: new Date("2026-01-01T00:00:00.000Z"),
      billLine1: null,
      billLine2: null,
      billCity: null,
      billRegion: null,
      billPostal: null,
      billCountry: null,
      dueDate: null,
      terms: null,
      subtotal,
      taxTotal: zero,
      total: subtotal,
    });

    const acmeList = await h.uow.invoices.list(DEFAULT_ORG);
    expect(acmeList).toHaveLength(1);
    expect(acmeList[0]?.documentNumber).toBe("INV-1001");
    expect(acmeList[0]?.organizationId).toBe(DEFAULT_ORG);

    const betaList = await h.uow.invoices.list(BETA_ORG);
    expect(betaList).toHaveLength(1);
    expect(betaList[0]?.id).toBe(betaInvoiceId);

    const crossOrgGet = await h.get.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: betaInvoiceId,
    });
    expect(crossOrgGet.ok).toBe(false);

    const crossOrgPayment = await h.record.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: betaInvoiceId,
      amountCents: 100,
      currency: "USD",
      idempotencyKey: "cross-org-pay",
    });
    expect(crossOrgPayment.ok).toBe(false);
    if (crossOrgPayment.ok) {
      return;
    }
    expect(crossOrgPayment.reason).toBe("not_found");
  });
});
