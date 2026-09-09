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
import type { InvoiceAdjustment, PaymentApplication } from "../src/index.js";
import {
  AdjustInvoiceUseCase,
  CreateInvoiceUseCase,
  EndPaymentPlanUseCase,
  PaymentId,
  ReallocatePaymentUseCase,
  RecordCustomerPaymentUseCase,
  SetPaymentPlanUseCase,
  VoidPaymentUseCase,
  computeAgingBucket,
  computeAgingBuckets,
  computeAvailableCreditCents,
  computeDaysPastDue,
  computeExposureCents,
  computeOpenBalanceCents,
  computePlanExpectations,
  computeRemainingCents,
  computeSumRemainingCents,
  computeUnappliedCents,
  computeUnappliedCreditCents,
  deriveInvoiceStatus,
  filterAdjustmentsForAsOf,
  filterApplicationsForAsOf,
  prefillPaymentApplicationsOldestDueFirst,
} from "../src/index.js";
import { InMemoryOpenOrderExposureReadPort } from "../src/adapters/in-memory-open-order-exposure-read.js";
import { testInvoiceSnapshotPorts } from "./support/invoice-snapshot-port-fixtures.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const AS_OF_TODAY = new Date("2026-09-09T00:00:00.000Z");

async function arHarness() {
  const uow = new InMemoryAccountingUnitOfWork();
  const ports = testInvoiceSnapshotPorts();
  return {
    uow,
    create: new CreateInvoiceUseCase(uow, ports.billToSnapshot, ports.customerTerms),
    recordCustomerPayment: new RecordCustomerPaymentUseCase(uow),
    reallocate: new ReallocatePaymentUseCase(uow),
    voidPayment: new VoidPaymentUseCase(uow),
    adjustInvoice: new AdjustInvoiceUseCase(uow),
    setPaymentPlan: new SetPaymentPlanUseCase(uow),
    endPaymentPlan: new EndPaymentPlanUseCase(uow),
  };
}

async function seedPostedInvoice(
  h: Awaited<ReturnType<typeof arHarness>>,
  input: {
    id: string;
    orderId: string;
    totalCents: number;
    dueDate: Date | null;
    customerId?: CustomerId;
  },
) {
  const zero = Money.fromMinorUnits(0, "USD");
  const total = Money.fromMinorUnits(input.totalCents, "USD");
  await h.uow.invoices.save({
    id: InvoiceId.parse(input.id),
    organizationId: DEFAULT_ORG,
    orderId: OrderId.parse(input.orderId),
    customerId: input.customerId ?? CUSTOMER_ID,
    documentNumber: `INV-${input.id.slice(0, 4)}`,
    status: "posted",
    postedAt: new Date("2026-01-01T00:00:00.000Z"),
    billLine1: null,
    billLine2: null,
    billCity: null,
    billRegion: null,
    billPostal: null,
    billCountry: null,
    dueDate: input.dueDate,
    terms: "Net 30",
    subtotal: total,
    taxTotal: zero,
    total,
  });
  return InvoiceId.parse(input.id);
}

async function seedThreeInvoicesWalkthrough(h: Awaited<ReturnType<typeof arHarness>>) {
  const oldestId = await seedPostedInvoice(h, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
    totalCents: 210_000,
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
  });
  const middleId = await seedPostedInvoice(h, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
    totalCents: 180_000,
    dueDate: new Date("2026-08-30T00:00:00.000Z"),
  });
  const newestId = await seedPostedInvoice(h, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc03",
    totalCents: 240_000,
    dueDate: new Date("2026-09-29T00:00:00.000Z"),
  });
  return { oldestId, middleId, newestId };
}

async function loadCustomerArState(
  h: Awaited<ReturnType<typeof arHarness>>,
  asOf?: Date,
) {
  const invoices = (await h.uow.invoices.list(DEFAULT_ORG)).filter(
    (invoice) => invoice.customerId === CUSTOMER_ID,
  );
  const applicationsByInvoiceId = new Map<InvoiceId, readonly PaymentApplication[]>(
    await Promise.all(
      invoices.map(async (invoice) => {
        const applications = await h.uow.invoices.listApplications(invoice.id);
        return [invoice.id, applications] as const;
      }),
    ),
  );
  const adjustmentsByInvoiceId = new Map<InvoiceId, readonly InvoiceAdjustment[]>(
    await Promise.all(
      invoices.map(async (invoice) => {
        const adjustments = await h.uow.invoices.listAdjustments(invoice.id);
        return [invoice.id, adjustments] as const;
      }),
    ),
  );
  const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
  const voidedPaymentIds = new Set<PaymentId>(
    payments.filter((payment) => payment.voidedAt != null).map((payment) => payment.id),
  );
  const applicationsByPaymentId = new Map<PaymentId, readonly PaymentApplication[]>(
    await Promise.all(
      payments.map(async (payment) => {
        const applications = await h.uow.invoices.listApplicationsByPayment(payment.id);
        return [payment.id, applications] as const;
      }),
    ),
  );
  const asOfContext =
    asOf === undefined ? undefined : { asOf, paymentsById };
  return {
    invoices,
    applicationsByInvoiceId,
    adjustmentsByInvoiceId,
    payments,
    paymentsById,
    voidedPaymentIds,
    applicationsByPaymentId,
    asOfContext,
  };
}

describe("AR customer payments (ADA-357 Done criteria)", () => {
  it("status precedence chooses paid over past_due, partial, and open", async () => {
    const h = await arHarness();
    const asOf = new Date("2026-02-15T00:00:00.000Z");
    const dueDate = new Date("2026-02-01T00:00:00.000Z");

    const paidId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
      totalCents: 1000,
      dueDate,
    });
    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "check",
      idempotencyKey: "paid-in-full",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: paidId, amountCents: 1000 }],
    });
    const paidInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, paidId))!;
    const paidApplications = await h.uow.invoices.listApplications(paidId);
    expect(deriveInvoiceStatus(paidInvoice, paidApplications, asOf)).toBe("paid");

    const pastDueId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
      totalCents: 800,
      dueDate,
    });
    const pastDueInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, pastDueId))!;
    expect(deriveInvoiceStatus(pastDueInvoice, [], asOf)).toBe("past_due");

    const partialId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc03",
      totalCents: 900,
      dueDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 300,
      currency: "USD",
      method: "card",
      idempotencyKey: "partial-pay",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: partialId, amountCents: 300 }],
    });
    const partialInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, partialId))!;
    const partialApplications = await h.uow.invoices.listApplications(partialId);
    expect(deriveInvoiceStatus(partialInvoice, partialApplications, asOf)).toBe("partial");

    const openId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc04",
      totalCents: 700,
      dueDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    const openInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, openId))!;
    expect(deriveInvoiceStatus(openInvoice, [], asOf)).toBe("open");
  });

  it("aging edges place 0, 1, 15, 16, 90, and 91 days past due in the expected buckets", () => {
    const dueDate = new Date("2026-01-01T00:00:00.000Z");
    const day = 24 * 60 * 60 * 1000;

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime()))).toBe("current");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime()))).toBe(0);

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime() + day))).toBe("1-15");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime() + day))).toBe(1);

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime() + 15 * day))).toBe("1-15");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime() + 15 * day))).toBe(15);

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime() + 16 * day))).toBe("16-30");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime() + 16 * day))).toBe(16);

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime() + 90 * day))).toBe("61-90");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime() + 90 * day))).toBe(90);

    expect(computeAgingBucket(dueDate, new Date(dueDate.getTime() + 91 * day))).toBe("90+");
    expect(computeDaysPastDue(dueDate, new Date(dueDate.getTime() + 91 * day))).toBe(91);
  });

  it("remainder without holdRemainderAsCredit flag is rejected", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc10",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const rejected = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1500,
      currency: "USD",
      method: "ach",
      idempotencyKey: "remainder-no-flag",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 1000 }],
    });

    expect(rejected.ok).toBe(false);
    if (rejected.ok) {
      return;
    }
    expect(rejected.reason).toBe("invalid");
  });

  it("remainder with holdRemainderAsCredit flag becomes unapplied credit", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc11",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1500,
      currency: "USD",
      method: "cash",
      idempotencyKey: "remainder-with-flag",
      holdRemainderAsCredit: true,
      applications: [{ invoiceId, amountCents: 1000 }],
    });

    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }
    expect(recorded.unappliedCents).toBe(500);

    const payment = await h.uow.invoices.findPaymentById(DEFAULT_ORG, recorded.paymentId);
    expect(payment).not.toBeNull();
    const applications = await h.uow.invoices.listApplicationsByPayment(recorded.paymentId);
    expect(computeUnappliedCents(payment!, applications)).toBe(500);
  });

  it("reallocate keeps payment total unchanged while moving application amounts", async () => {
    const h = await arHarness();
    const firstInvoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc20",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const secondInvoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc21",
      totalCents: 800,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "check",
      idempotencyKey: "reallocate-source",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: firstInvoiceId, amountCents: 1000 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    const reallocated = await h.reallocate.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      applications: [
        { invoiceId: firstInvoiceId, deltaCents: -300 },
        { invoiceId: secondInvoiceId, deltaCents: 300 },
      ],
    });
    expect(reallocated.ok).toBe(true);
    if (!reallocated.ok) {
      return;
    }
    expect(reallocated.unappliedCents).toBe(0);

    const payment = await h.uow.invoices.findPaymentById(DEFAULT_ORG, recorded.paymentId);
    expect(payment?.amount.amountMinor).toBe(1000);

    const firstApplications = await h.uow.invoices.listApplications(firstInvoiceId);
    const secondApplications = await h.uow.invoices.listApplications(secondInvoiceId);
    const firstInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, firstInvoiceId))!;
    const secondInvoice = (await h.uow.invoices.findById(DEFAULT_ORG, secondInvoiceId))!;
    expect(computeRemainingCents(firstInvoice, firstApplications)).toBe(300);
    expect(computeRemainingCents(secondInvoice, secondApplications)).toBe(500);
  });

  it("void zeroes applied and unapplied amounts for the payment", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa30",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc30",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1200,
      currency: "USD",
      method: "card",
      idempotencyKey: "void-target",
      holdRemainderAsCredit: true,
      applications: [{ invoiceId, amountCents: 700 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    const beforeVoidApplications = await h.uow.invoices.listApplicationsByPayment(
      recorded.paymentId,
    );
    const paymentBefore = (await h.uow.invoices.findPaymentById(
      DEFAULT_ORG,
      recorded.paymentId,
    ))!;
    expect(computeUnappliedCents(paymentBefore, beforeVoidApplications)).toBe(500);

    const voided = await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      voidReason: "entered in error",
    });
    expect(voided.ok).toBe(true);
    if (!voided.ok) {
      return;
    }
    expect(voided.unappliedCents).toBe(0);

    const invoice = (await h.uow.invoices.findById(DEFAULT_ORG, invoiceId))!;
    const applications = await h.uow.invoices.listApplications(invoiceId);
    expect(computeRemainingCents(invoice, applications, new Set([recorded.paymentId]))).toBe(
      1000,
    );

    const paymentAfter = (await h.uow.invoices.findPaymentById(
      DEFAULT_ORG,
      recorded.paymentId,
    ))!;
    const afterApplications = await h.uow.invoices.listApplicationsByPayment(recorded.paymentId);
    expect(computeUnappliedCents(paymentAfter, afterApplications)).toBe(0);
  });

  it("adjustment bounds keep remaining between zero and invoice total", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa40",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc40",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const tooLarge = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 1001,
      reason: "too much",
    });
    expect(tooLarge.ok).toBe(false);

    const valid = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "credit_memo",
      amountCents: 250,
      reason: "goodwill credit",
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) {
      return;
    }
    expect(valid.remainingCents).toBe(750);

    const overAdjust = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 800,
      reason: "would go negative",
    });
    expect(overAdjust.ok).toBe(false);
  });

  it("plan expectations compute next date, estimated end, and installments received", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa50",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc50",
      totalCents: 2500,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const startsOn = new Date("2026-01-01T00:00:00.000Z");
    const planResult = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "monthly",
      installmentAmountCents: 1000,
      currency: "USD",
      startsOn,
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "card",
      receivedAt: new Date("2026-01-05T00:00:00.000Z"),
      idempotencyKey: "plan-installment-1",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 1000 }],
    });

    const asOf = new Date("2026-01-20T00:00:00.000Z");
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const expectations = computePlanExpectations(planResult.plan, 1500, asOf, payments);

    expect(expectations.installmentsReceived).toBe(1);
    expect(expectations.installmentsExpectedSoFar).toBe(1);
    expect(expectations.missedInstallments).toBe(0);
    expect(expectations.complete).toBe(false);
    expect(expectations.estimatedEndOn?.toISOString()).toBe(
      new Date("2026-02-01T00:00:00.000Z").toISOString(),
    );
    expect(expectations.nextExpectedOn?.toISOString()).toBe(
      new Date("2026-02-01T00:00:00.000Z").toISOString(),
    );
  });

  it("idempotency conflict rejects the same key with a different payload", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa60",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc60",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const first = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 500,
      currency: "USD",
      method: "check",
      idempotencyKey: "customer-idem-conflict",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 500 }],
    });
    expect(first.ok).toBe(true);

    const conflict = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 600,
      currency: "USD",
      method: "check",
      idempotencyKey: "customer-idem-conflict",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 600 }],
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) {
      return;
    }
    expect(conflict.reason).toBe("conflict");
  });

  it("rejects two application lines on one invoice whose combined amount exceeds remaining", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc61",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const overpay = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "check",
      idempotencyKey: "split-line-overpay",
      holdRemainderAsCredit: false,
      applications: [
        { invoiceId, amountCents: 600 },
        { invoiceId, amountCents: 500 },
      ],
    });
    expect(overpay.ok).toBe(false);
    if (overpay.ok) {
      return;
    }
    expect(overpay.reason).toBe("overpay");
  });

  it("idempotency conflict rejects the same key with a different receivedAt", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc62",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const receivedAt = new Date("2026-03-01T00:00:00.000Z");

    const first = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 500,
      currency: "USD",
      method: "check",
      receivedAt,
      idempotencyKey: "received-at-conflict",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 500 }],
    });
    expect(first.ok).toBe(true);

    const conflict = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 500,
      currency: "USD",
      method: "check",
      receivedAt: new Date("2026-03-02T00:00:00.000Z"),
      idempotencyKey: "received-at-conflict",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 500 }],
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) {
      return;
    }
    expect(conflict.reason).toBe("conflict");
  });

  it("treats same customer payment key and payload as no-op success", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa63",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc63",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const receivedAt = new Date("2026-03-01T00:00:00.000Z");

    const first = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 400,
      currency: "USD",
      method: "card",
      receivedAt,
      idempotencyKey: "customer-idem-noop",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 400 }],
    });
    expect(first.ok).toBe(true);

    const second = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 400,
      currency: "USD",
      method: "card",
      receivedAt,
      idempotencyKey: "customer-idem-noop",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 400 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.remainingByInvoiceId[String(invoiceId)]).toBe(600);
  });

  it("reallocate rejects two positive deltas to the same invoice that exceed remaining", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa64",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc64",
      totalCents: 500,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const secondInvoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa65",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc65",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "check",
      idempotencyKey: "reallocate-multi-delta",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: secondInvoiceId, amountCents: 1000 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    const reallocated = await h.reallocate.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      applications: [
        { invoiceId: secondInvoiceId, deltaCents: -500 },
        { invoiceId, deltaCents: 300 },
        { invoiceId, deltaCents: 300 },
      ],
    });
    expect(reallocated.ok).toBe(false);
    if (reallocated.ok) {
      return;
    }
    expect(reallocated.reason).toBe("overpay");
  });

  it("end payment plan allows a replacement plan and rejects ending twice", async () => {
    const h = await arHarness();
    const startsOn = new Date("2026-01-01T00:00:00.000Z");
    const planResult = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "monthly",
      installmentAmountCents: 1000,
      currency: "USD",
      startsOn,
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    const ended = await h.endPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      planId: planResult.plan.id,
    });
    expect(ended.ok).toBe(true);

    const replacement = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "weekly",
      installmentAmountCents: 250,
      currency: "USD",
      startsOn: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(replacement.ok).toBe(true);

    const secondEnd = await h.endPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      planId: planResult.plan.id,
    });
    expect(secondEnd.ok).toBe(false);
    if (secondEnd.ok) {
      return;
    }
    expect(secondEnd.reason).toBe("conflict");
  });

  it("filterApplicationsForAsOf excludes voided payments without an explicit voided set", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa66",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc66",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 600,
      currency: "USD",
      method: "card",
      receivedAt: new Date("2026-01-10T00:00:00.000Z"),
      idempotencyKey: "voided-asof-map",
      holdRemainderAsCredit: true,
      applications: [{ invoiceId, amountCents: 400 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      voidReason: "entered in error",
    });

    const asOf = new Date("2026-01-20T00:00:00.000Z");
    const invoice = (await h.uow.invoices.findById(DEFAULT_ORG, invoiceId))!;
    const applications = await h.uow.invoices.listApplications(invoiceId);
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
    const asOfContext = { asOf, paymentsById };

    expect(
      filterApplicationsForAsOf(applications, asOfContext, new Set()).map(
        (row) => row.amount.amountMinor,
      ),
    ).toEqual([]);
    expect(computeRemainingCents(invoice, applications, new Set(), [], asOfContext)).toBe(1000);
  });

  it("credit memo alone yields partial status before paid", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa70",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc70",
      totalCents: 1000,
      dueDate: new Date("2027-03-01T00:00:00.000Z"),
    });

    const adjusted = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "credit_memo",
      amountCents: 200,
      reason: "goodwill",
    });
    expect(adjusted.ok).toBe(true);

    const invoice = (await h.uow.invoices.findById(DEFAULT_ORG, invoiceId))!;
    const adjustments = await h.uow.invoices.listAdjustments(invoiceId);
    const asOf = adjustments[0]!.createdAt;
    expect(deriveInvoiceStatus(invoice, [], asOf, new Set(), adjustments)).toBe("partial");
  });

  it("prepay without open invoices is rejected unless holdRemainderAsCredit is true", async () => {
    const h = await arHarness();

    const rejected = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "ach",
      idempotencyKey: "prepay-no-flag",
      holdRemainderAsCredit: false,
      applications: [],
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) {
      return;
    }
    expect(rejected.reason).toBe("invalid");

    const prepay = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 1000,
      currency: "USD",
      method: "ach",
      idempotencyKey: "prepay-with-flag",
      holdRemainderAsCredit: true,
      applications: [],
    });
    expect(prepay.ok).toBe(true);
    if (!prepay.ok) {
      return;
    }
    expect(prepay.unappliedCents).toBe(1000);
  });

  it("prefill helper allocates oldest due first with posted-date ties", async () => {
    const h = await arHarness();
    const olderDue = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa80",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc80",
      totalCents: 500,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const newerDue = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa81",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc81",
      totalCents: 800,
      dueDate: new Date("2026-03-01T00:00:00.000Z"),
    });

    const invoices = [
      (await h.uow.invoices.findById(DEFAULT_ORG, olderDue))!,
      (await h.uow.invoices.findById(DEFAULT_ORG, newerDue))!,
    ];
    const applicationsByInvoiceId = new Map([
      [olderDue, await h.uow.invoices.listApplications(olderDue)],
      [newerDue, await h.uow.invoices.listApplications(newerDue)],
    ]);
    const adjustmentsByInvoiceId = new Map([
      [olderDue, await h.uow.invoices.listAdjustments(olderDue)],
      [newerDue, await h.uow.invoices.listAdjustments(newerDue)],
    ]);

    const prefill = prefillPaymentApplicationsOldestDueFirst(
      invoices,
      applicationsByInvoiceId,
      adjustmentsByInvoiceId,
      900,
    );
    expect(prefill.applications).toEqual([
      { invoiceId: olderDue, amountCents: 500 },
      { invoiceId: newerDue, amountCents: 400 },
    ]);
    expect(prefill.remainderCents).toBe(0);
  });

  it("as-of ignores future-dated invoices, payments, and adjustments", async () => {
    const h = await arHarness();
    const asOf = new Date("2026-02-01T00:00:00.000Z");
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa90",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc90",
      totalCents: 1000,
      dueDate: new Date("2026-01-15T00:00:00.000Z"),
    });

    const futurePayment = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 400,
      currency: "USD",
      method: "check",
      receivedAt: new Date("2026-02-15T00:00:00.000Z"),
      idempotencyKey: "future-payment",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 400 }],
    });
    expect(futurePayment.ok).toBe(true);

    const invoice = (await h.uow.invoices.findById(DEFAULT_ORG, invoiceId))!;
    const applications = await h.uow.invoices.listApplications(invoiceId);
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
    const asOfContext = { asOf, paymentsById };

    expect(
      computeRemainingCents(invoice, applications, new Set(), [], asOfContext),
    ).toBe(1000);
    expect(deriveInvoiceStatus(invoice, applications, asOf, new Set(), [], asOfContext)).toBe(
      "past_due",
    );

    const futureAdjustment = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "credit_memo",
      amountCents: 100,
      reason: "future credit",
    });
    expect(futureAdjustment.ok).toBe(true);
    const adjustments = await h.uow.invoices.listAdjustments(invoiceId);
    const visibleAdjustments = filterAdjustmentsForAsOf(adjustments, asOf);
    expect(visibleAdjustments).toHaveLength(0);
    expect(
      computeRemainingCents(invoice, applications, new Set(), adjustments, asOfContext),
    ).toBe(1000);
    expect(
      filterApplicationsForAsOf(applications, asOfContext, new Set()).map((row) => row.amount.amountMinor),
    ).toEqual([]);
  });

  it("voided payment is ignored at every asOf even when voided after the as-of date", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa91",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc91",
      totalCents: 1000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 600,
      currency: "USD",
      method: "card",
      receivedAt: new Date("2026-01-10T00:00:00.000Z"),
      idempotencyKey: "void-asof",
      holdRemainderAsCredit: true,
      applications: [{ invoiceId, amountCents: 400 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    const voided = await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      voidReason: "entered in error",
    });
    expect(voided.ok).toBe(true);

    const asOfBeforeVoid = new Date("2026-01-20T00:00:00.000Z");
    const invoice = (await h.uow.invoices.findById(DEFAULT_ORG, invoiceId))!;
    const applications = await h.uow.invoices.listApplications(invoiceId);
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const payment = payments.find((row) => row.id === recorded.paymentId)!;
    const voidedIds = new Set<PaymentId>([recorded.paymentId]);

    expect(computeRemainingCents(invoice, applications, voidedIds)).toBe(1000);
    expect(computeUnappliedCents(payment, await h.uow.invoices.listApplicationsByPayment(recorded.paymentId))).toBe(0);

    const applicationsByInvoiceId = new Map([[invoiceId, applications]]);
    const adjustmentsByInvoiceId = new Map([[invoiceId, []]]);
    const applicationsByPaymentId = new Map([
      [recorded.paymentId, await h.uow.invoices.listApplicationsByPayment(recorded.paymentId)],
    ]);
    expect(
      computeOpenBalanceCents(
        [invoice],
        applicationsByInvoiceId,
        adjustmentsByInvoiceId,
        payments,
        applicationsByPaymentId,
        voidedIds,
      ),
    ).toBe(1000);
  });

  it("plan expectations count every non-void payment after startsOn and show missed installments", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa92",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc92",
      totalCents: 3000,
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const startsOn = new Date("2026-01-01T00:00:00.000Z");
    const planResult = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "monthly",
      installmentAmountCents: 1000,
      currency: "USD",
      startsOn,
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 250,
      currency: "USD",
      method: "card",
      receivedAt: new Date("2026-01-05T00:00:00.000Z"),
      idempotencyKey: "small-installment",
      holdRemainderAsCredit: true,
      applications: [],
    });
    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 100,
      currency: "USD",
      method: "cash",
      receivedAt: new Date("2026-01-20T00:00:00.000Z"),
      idempotencyKey: "tiny-installment",
      holdRemainderAsCredit: true,
      applications: [],
    });

    const asOf = new Date("2026-02-15T00:00:00.000Z");
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const expectations = computePlanExpectations(planResult.plan, 3000, asOf, payments);

    expect(expectations.installmentsReceived).toBe(2);
    expect(expectations.installmentsExpectedSoFar).toBe(2);
    expect(expectations.missedInstallments).toBe(0);
  });
});

describe("AR prototype walkthroughs (ADA-357)", () => {
  it("walkthrough 1: $5,000 to oldest prefills oldest-due-first and updates status and aging", async () => {
    const h = await arHarness();
    const { oldestId, middleId, newestId } = await seedThreeInvoicesWalkthrough(h);
    const state = await loadCustomerArState(h);

    const prefill = prefillPaymentApplicationsOldestDueFirst(
      state.invoices,
      state.applicationsByInvoiceId,
      state.adjustmentsByInvoiceId,
      500_000,
    );
    expect(prefill.applications).toEqual([
      { invoiceId: oldestId, amountCents: 210_000 },
      { invoiceId: middleId, amountCents: 180_000 },
      { invoiceId: newestId, amountCents: 110_000 },
    ]);
    expect(prefill.remainderCents).toBe(0);

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 500_000,
      currency: "USD",
      method: "check",
      reference: "#4471",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "walkthrough-5000",
      holdRemainderAsCredit: false,
      applications: prefill.applications,
    });
    expect(recorded.ok).toBe(true);

    const after = await loadCustomerArState(h);
    const oldest = after.invoices.find((invoice) => invoice.id === oldestId)!;
    const middle = after.invoices.find((invoice) => invoice.id === middleId)!;
    const newest = after.invoices.find((invoice) => invoice.id === newestId)!;
    expect(
      computeRemainingCents(
        oldest,
        after.applicationsByInvoiceId.get(oldestId) ?? [],
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(oldestId) ?? [],
        after.asOfContext,
      ),
    ).toBe(0);
    expect(
      computeRemainingCents(
        middle,
        after.applicationsByInvoiceId.get(middleId) ?? [],
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(middleId) ?? [],
        after.asOfContext,
      ),
    ).toBe(0);
    expect(
      computeRemainingCents(
        newest,
        after.applicationsByInvoiceId.get(newestId) ?? [],
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(newestId) ?? [],
        after.asOfContext,
      ),
    ).toBe(130_000);
    expect(
      deriveInvoiceStatus(
        oldest,
        after.applicationsByInvoiceId.get(oldestId) ?? [],
        AS_OF_TODAY,
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(oldestId) ?? [],
      ),
    ).toBe("paid");
    expect(
      deriveInvoiceStatus(
        middle,
        after.applicationsByInvoiceId.get(middleId) ?? [],
        AS_OF_TODAY,
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(middleId) ?? [],
      ),
    ).toBe("paid");
    expect(
      deriveInvoiceStatus(
        newest,
        after.applicationsByInvoiceId.get(newestId) ?? [],
        AS_OF_TODAY,
        after.voidedPaymentIds,
        after.adjustmentsByInvoiceId.get(newestId) ?? [],
      ),
    ).toBe("partial");

    const agingAsOf = { asOf: AS_OF_TODAY, paymentsById: after.paymentsById };
    const aging = computeAgingBuckets(
      after.invoices,
      after.applicationsByInvoiceId,
      after.adjustmentsByInvoiceId,
      AS_OF_TODAY,
      after.voidedPaymentIds,
      agingAsOf,
    );
    expect(aging.current).toBe(130_000);
    expect(aging["1-15"] + aging["16-30"] + aging["31-45"] + aging["46-60"] + aging["61-90"] + aging["90+"]).toBe(0);
  });

  it("walkthrough 2: overpayment requires hold flag, credit does not auto-apply, reallocate applies credit", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabb01",
      orderId: "cccccccc-cccc-4ccc-8ccc-ccccccccbb01",
      totalCents: 120_000,
      dueDate: new Date("2026-08-20T00:00:00.000Z"),
    });

    const rejected = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 150_000,
      currency: "USD",
      method: "check",
      idempotencyKey: "overpay-no-hold",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 120_000 }],
    });
    expect(rejected.ok).toBe(false);

    const overpaid = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 150_000,
      currency: "USD",
      method: "check",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "overpay-with-hold",
      holdRemainderAsCredit: true,
      applications: [{ invoiceId, amountCents: 120_000 }],
    });
    expect(overpaid.ok).toBe(true);
    if (!overpaid.ok) {
      return;
    }
    expect(overpaid.unappliedCents).toBe(30_000);

    const newInvoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabb02",
      orderId: "cccccccc-cccc-4ccc-8ccc-ccccccccbb02",
      totalCents: 90_000,
      dueDate: new Date("2026-10-09T00:00:00.000Z"),
    });
    const beforeApply = await loadCustomerArState(h);
    const newInvoice = beforeApply.invoices.find((invoice) => invoice.id === newInvoiceId)!;
    expect(
      computeRemainingCents(
        newInvoice,
        beforeApply.applicationsByInvoiceId.get(newInvoiceId) ?? [],
        beforeApply.voidedPaymentIds,
        beforeApply.adjustmentsByInvoiceId.get(newInvoiceId) ?? [],
        beforeApply.asOfContext,
      ),
    ).toBe(90_000);

    const applied = await h.reallocate.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: overpaid.paymentId,
      applications: [{ invoiceId: newInvoiceId, deltaCents: 30_000 }],
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) {
      return;
    }
    expect(applied.unappliedCents).toBe(0);

    const afterApply = await loadCustomerArState(h);
    const newInvoiceAfter = afterApply.invoices.find((invoice) => invoice.id === newInvoiceId)!;
    expect(
      computeRemainingCents(
        newInvoiceAfter,
        afterApply.applicationsByInvoiceId.get(newInvoiceId) ?? [],
        afterApply.voidedPaymentIds,
        afterApply.adjustmentsByInvoiceId.get(newInvoiceId) ?? [],
        afterApply.asOfContext,
      ),
    ).toBe(60_000);
    expect(
      computeOpenBalanceCents(
        afterApply.invoices,
        afterApply.applicationsByInvoiceId,
        afterApply.adjustmentsByInvoiceId,
        afterApply.payments,
        afterApply.applicationsByPaymentId,
        afterApply.voidedPaymentIds,
        afterApply.asOfContext,
      ),
    ).toBe(60_000);
  });

  it("walkthrough 3: wrong invoice reallocate rejects over-move and keeps payment total with append-only rows", async () => {
    const h = await arHarness();
    const { oldestId, newestId } = await seedThreeInvoicesWalkthrough(h);

    const recorded = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 180_000,
      currency: "USD",
      method: "check",
      reference: "#4480",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "wrong-invoice",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: newestId, amountCents: 180_000 }],
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }

    const beforeRows = await h.uow.invoices.listApplicationsByPayment(recorded.paymentId);
    expect(beforeRows).toHaveLength(1);

    const tooMuch = await h.reallocate.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      applications: [
        { invoiceId: newestId, deltaCents: -200_000 },
        { invoiceId: oldestId, deltaCents: 200_000 },
      ],
    });
    expect(tooMuch.ok).toBe(false);

    const moved = await h.reallocate.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: recorded.paymentId,
      applications: [
        { invoiceId: newestId, deltaCents: -180_000 },
        { invoiceId: oldestId, deltaCents: 180_000 },
      ],
    });
    expect(moved.ok).toBe(true);

    const payment = await h.uow.invoices.findPaymentById(DEFAULT_ORG, recorded.paymentId);
    expect(payment?.amount.amountMinor).toBe(180_000);

    const afterRows = await h.uow.invoices.listApplicationsByPayment(recorded.paymentId);
    expect(afterRows).toHaveLength(3);
    expect(afterRows[0]!.amount.amountMinor).toBe(180_000);
    expect(afterRows[1]!.amount.amountMinor).toBe(-180_000);
    expect(afterRows[2]!.amount.amountMinor).toBe(180_000);

    const state = await loadCustomerArState(h);
    const oldest = state.invoices.find((invoice) => invoice.id === oldestId)!;
    const newest = state.invoices.find((invoice) => invoice.id === newestId)!;
    expect(
      computeRemainingCents(
        oldest,
        state.applicationsByInvoiceId.get(oldestId) ?? [],
        state.voidedPaymentIds,
        state.adjustmentsByInvoiceId.get(oldestId) ?? [],
        state.asOfContext,
      ),
    ).toBe(30_000);
    expect(
      computeRemainingCents(
        newest,
        state.applicationsByInvoiceId.get(newestId) ?? [],
        state.voidedPaymentIds,
        state.adjustmentsByInvoiceId.get(newestId) ?? [],
        state.asOfContext,
      ),
    ).toBe(240_000);
  });

  it("walkthrough 4: wrong amount void clears projections, re-entry works, double void fails", async () => {
    const h = await arHarness();
    await seedThreeInvoicesWalkthrough(h);
    const state = await loadCustomerArState(h);
    const prefill = prefillPaymentApplicationsOldestDueFirst(
      state.invoices,
      state.applicationsByInvoiceId,
      state.adjustmentsByInvoiceId,
      500_000,
    );

    const mistake = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 500_000,
      currency: "USD",
      method: "card",
      reference: "…4242",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "void-mistake",
      holdRemainderAsCredit: false,
      applications: prefill.applications,
    });
    expect(mistake.ok).toBe(true);
    if (!mistake.ok) {
      return;
    }

    const voided = await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: mistake.paymentId,
      voidReason: "keyed $5,000 instead of $500",
    });
    expect(voided.ok).toBe(true);

    const afterVoid = await loadCustomerArState(h);
    expect(
      computeOpenBalanceCents(
        afterVoid.invoices,
        afterVoid.applicationsByInvoiceId,
        afterVoid.adjustmentsByInvoiceId,
        afterVoid.payments,
        afterVoid.applicationsByPaymentId,
        afterVoid.voidedPaymentIds,
        afterVoid.asOfContext,
      ),
    ).toBe(630_000);

    const correctedPrefill = prefillPaymentApplicationsOldestDueFirst(
      afterVoid.invoices,
      afterVoid.applicationsByInvoiceId,
      afterVoid.adjustmentsByInvoiceId,
      50_000,
    );
    const corrected = await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 50_000,
      currency: "USD",
      method: "card",
      reference: "…4242",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "void-corrected",
      holdRemainderAsCredit: false,
      applications: correctedPrefill.applications,
    });
    expect(corrected.ok).toBe(true);

    const doubleVoid = await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: mistake.paymentId,
      voidReason: "again",
    });
    expect(doubleVoid.ok).toBe(false);
    if (doubleVoid.ok) {
      return;
    }
    expect(doubleVoid.reason).toBe("conflict");
  });

  it("walkthrough 5: bad debt write-off requires reason, bounds remaining, and negative adjustment reverses", async () => {
    const h = await arHarness();
    const invoiceId = await seedPostedInvoice(h, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaacc01",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
      totalCents: 84_550,
      dueDate: new Date("2026-04-02T00:00:00.000Z"),
    });
    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 80_000,
      currency: "USD",
      method: "check",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "bad-debt-partial",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 80_000 }],
    });

    const noReason = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 4_550,
      reason: "   ",
    });
    expect(noReason.ok).toBe(false);

    const tooMuch = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 6_000,
      reason: "bad debt",
    });
    expect(tooMuch.ok).toBe(false);

    const writtenOff = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 4_550,
      reason: "short pay, not worth chasing",
    });
    expect(writtenOff.ok).toBe(true);
    if (!writtenOff.ok) {
      return;
    }
    expect(writtenOff.remainingCents).toBe(0);

    const state = await loadCustomerArState(h);
    const invoice = state.invoices.find((row) => row.id === invoiceId)!;
    expect(
      deriveInvoiceStatus(
        invoice,
        state.applicationsByInvoiceId.get(invoiceId) ?? [],
        AS_OF_TODAY,
        state.voidedPaymentIds,
        state.adjustmentsByInvoiceId.get(invoiceId) ?? [],
      ),
    ).toBe("paid");

    const reversed = await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: -4_550,
      reason: "reversed: check arrived",
    });
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) {
      return;
    }
    expect(reversed.remainingCents).toBe(4_550);
  });

  it("walkthrough 6: payment plan counts installments, shows missed after time jump, rejects second active plan", async () => {
    const h = await arHarness();
    await seedThreeInvoicesWalkthrough(h);
    const startsOn = AS_OF_TODAY;

    const planResult = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "monthly",
      installmentAmountCents: 100_000,
      currency: "USD",
      startsOn,
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    const prefill = prefillPaymentApplicationsOldestDueFirst(
      (await loadCustomerArState(h)).invoices,
      (await loadCustomerArState(h)).applicationsByInvoiceId,
      (await loadCustomerArState(h)).adjustmentsByInvoiceId,
      100_000,
    );
    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 100_000,
      currency: "USD",
      method: "card",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "plan-installment",
      holdRemainderAsCredit: false,
      applications: prefill.applications,
    });

    const jumpedAsOf = new Date("2026-11-08T00:00:00.000Z");
    const payments = await h.uow.invoices.listPaymentsByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    const openBalance = computeOpenBalanceCents(
      (await loadCustomerArState(h, jumpedAsOf)).invoices,
      (await loadCustomerArState(h, jumpedAsOf)).applicationsByInvoiceId,
      (await loadCustomerArState(h, jumpedAsOf)).adjustmentsByInvoiceId,
      payments,
      (await loadCustomerArState(h, jumpedAsOf)).applicationsByPaymentId,
      (await loadCustomerArState(h, jumpedAsOf)).voidedPaymentIds,
      { asOf: jumpedAsOf, paymentsById: new Map(payments.map((payment) => [payment.id, payment])) },
    );
    const expectations = computePlanExpectations(planResult.plan, openBalance, jumpedAsOf, payments);
    expect(expectations.installmentsReceived).toBe(1);
    expect(expectations.installmentsExpectedSoFar).toBeGreaterThanOrEqual(2);
    expect(expectations.missedInstallments).toBeGreaterThan(0);

    const secondPlan = await h.setPaymentPlan.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      frequency: "weekly",
      installmentAmountCents: 50_000,
      currency: "USD",
      startsOn: jumpedAsOf,
    });
    expect(secondPlan.ok).toBe(false);
    if (secondPlan.ok) {
      return;
    }
    expect(secondPlan.reason).toBe("conflict");
  });

  it("walkthrough 7: credit limit exposure includes unshipped, held credit raises availability, $0 means no credit", async () => {
    const h = await arHarness();
    await seedThreeInvoicesWalkthrough(h);
    const exposurePort = new InMemoryOpenOrderExposureReadPort();
    const state = await loadCustomerArState(h);
    const sumRemaining = computeSumRemainingCents(
      state.invoices,
      state.applicationsByInvoiceId,
      state.adjustmentsByInvoiceId,
      state.voidedPaymentIds,
      state.asOfContext,
    );
    const unappliedCredit = computeUnappliedCreditCents(
      state.payments,
      state.applicationsByPaymentId,
    );
    expect(sumRemaining).toBe(630_000);
    expect(unappliedCredit).toBe(0);

    exposurePort.setExposure(DEFAULT_ORG, CUSTOMER_ID, 150_000);
    const confirmedUnshipped = await exposurePort.getOpenOrderExposureCents(
      DEFAULT_ORG,
      CUSTOMER_ID,
    );
    const exposureBeforePrepay = computeExposureCents(sumRemaining, confirmedUnshipped, unappliedCredit);
    expect(exposureBeforePrepay).toBe(780_000);
    expect(computeAvailableCreditCents(750_000, exposureBeforePrepay)).toBe(-30_000);

    await h.recordCustomerPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 100_000,
      currency: "USD",
      method: "ach",
      receivedAt: AS_OF_TODAY,
      idempotencyKey: "credit-limit-prepay",
      holdRemainderAsCredit: true,
      applications: [],
    });

    const afterPrepay = await loadCustomerArState(h);
    const unappliedAfter = computeUnappliedCreditCents(
      afterPrepay.payments,
      afterPrepay.applicationsByPaymentId,
    );
    const exposureAfterPrepay = computeExposureCents(sumRemaining, confirmedUnshipped, unappliedAfter);
    expect(unappliedAfter).toBe(100_000);
    expect(exposureAfterPrepay).toBe(680_000);
    expect(computeAvailableCreditCents(750_000, exposureAfterPrepay)).toBe(70_000);

    expect(computeAvailableCreditCents(0, exposureAfterPrepay)).toBe(-680_000);
  });

  it("walkthrough 8: aging as-of steps remaining across buckets without writes", async () => {
    const h = await arHarness();
    const { oldestId, middleId, newestId } = await seedThreeInvoicesWalkthrough(h);

    const asOfDay1 = new Date("2026-09-09T00:00:00.000Z");
    const stateDay1 = await loadCustomerArState(h, asOfDay1);
    const agingDay1 = computeAgingBuckets(
      stateDay1.invoices,
      stateDay1.applicationsByInvoiceId,
      stateDay1.adjustmentsByInvoiceId,
      asOfDay1,
      stateDay1.voidedPaymentIds,
      stateDay1.asOfContext,
    );
    expect(agingDay1.current).toBe(240_000);
    expect(agingDay1["1-15"]).toBe(180_000);
    expect(agingDay1["31-45"]).toBe(210_000);

    const asOfDay2 = new Date("2026-09-16T00:00:00.000Z");
    const stateDay2 = await loadCustomerArState(h, asOfDay2);
    const agingDay2 = computeAgingBuckets(
      stateDay2.invoices,
      stateDay2.applicationsByInvoiceId,
      stateDay2.adjustmentsByInvoiceId,
      asOfDay2,
      stateDay2.voidedPaymentIds,
      stateDay2.asOfContext,
    );
    expect(agingDay2.current).toBe(240_000);
    expect(agingDay2["16-30"]).toBe(180_000);
    expect(agingDay2["46-60"]).toBe(210_000);

    const asOfDay3 = new Date("2026-10-16T00:00:00.000Z");
    const stateDay3 = await loadCustomerArState(h, asOfDay3);
    const agingDay3 = computeAgingBuckets(
      stateDay3.invoices,
      stateDay3.applicationsByInvoiceId,
      stateDay3.adjustmentsByInvoiceId,
      asOfDay3,
      stateDay3.voidedPaymentIds,
      stateDay3.asOfContext,
    );
    expect(agingDay3["16-30"]).toBe(240_000);
    expect(agingDay3["46-60"]).toBe(180_000);
    expect(agingDay3["61-90"]).toBe(210_000);

    const asOfBack = new Date("2026-09-09T00:00:00.000Z");
    const stateBack = await loadCustomerArState(h, asOfBack);
    expect(
      computeRemainingCents(
        stateBack.invoices.find((invoice) => invoice.id === oldestId)!,
        stateBack.applicationsByInvoiceId.get(oldestId) ?? [],
        stateBack.voidedPaymentIds,
        stateBack.adjustmentsByInvoiceId.get(oldestId) ?? [],
        stateBack.asOfContext,
      ),
    ).toBe(210_000);
    expect(agingDay1).toEqual(
      computeAgingBuckets(
        stateBack.invoices,
        stateBack.applicationsByInvoiceId,
        stateBack.adjustmentsByInvoiceId,
        asOfBack,
        stateBack.voidedPaymentIds,
        stateBack.asOfContext,
      ),
    );
  });
});
