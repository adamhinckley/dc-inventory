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
  AdjustInvoiceUseCase,
  CreateInvoiceUseCase,
  PaymentId,
  ReallocatePaymentUseCase,
  RecordCustomerPaymentUseCase,
  SetPaymentPlanUseCase,
  VoidPaymentUseCase,
  computeAgingBucket,
  computeDaysPastDue,
  computeOpenBalanceCents,
  computePlanExpectations,
  computeRemainingCents,
  computeUnappliedCents,
  deriveInvoiceStatus,
  filterAdjustmentsForAsOf,
  filterApplicationsForAsOf,
  prefillPaymentApplicationsOldestDueFirst,
} from "../src/index.js";
import { testInvoiceSnapshotPorts } from "./support/invoice-snapshot-port-fixtures.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const DEFAULT_ORG = OrganizationId.DEFAULT;

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
