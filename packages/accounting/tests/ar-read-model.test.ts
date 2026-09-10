import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryOpenOrderExposureReadAdapter,
  InMemorySalesOrderRepository,
  SalesOrderLineId,
} from "@dc-inventory/sales";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { AvailableCreditReadAdapter } from "../src/adapters/available-credit-read.js";
import { InMemoryArCustomerReadPort } from "../src/adapters/in-memory-ar-customer-read-port.js";
import { InMemoryArOrgReadPort } from "../src/adapters/in-memory-ar-org-read-port.js";
import { InMemoryCustomerArProfileReadPort } from "../src/adapters/in-memory-customer-ar-profile-read.js";
import { InMemoryCustomerBalancesListQuery } from "../src/adapters/in-memory-customer-balances-list-query.js";
import { InMemoryLastOrderDateReadPort } from "../src/adapters/in-memory-last-order-date-read.js";
import { InMemoryPaymentsReceivedListQuery } from "../src/adapters/in-memory-payments-received-list-query.js";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import {
  AdjustInvoiceUseCase,
  GetAccountingSummaryUseCase,
  GetCustomerAccountingSummaryUseCase,
  InvoiceAdjustmentId,
  ListCustomerBalancesQuery,
  ListPaymentsReceivedQuery,
  RecordCustomerPaymentUseCase,
  SetPaymentPlanUseCase,
  VoidPaymentUseCase,
} from "../src/index.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const AS_OF = new Date("2026-09-09T00:00:00.000Z");

const CUSTOMER_OPEN = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01");
const CUSTOMER_PARTIAL = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02");
const CUSTOMER_PAST_DUE = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03");
const CUSTOMER_PAID = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04");
const CUSTOMER_VOIDED = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05");
const CUSTOMER_ADJUSTED = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06");
const CUSTOMER_CREDIT = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07");

async function readHarness() {
  const clock = new InMemoryClock(AS_OF);
  const uow = new InMemoryAccountingUnitOfWork();
  const customers = new InMemoryCustomerRepository();
  const salesOrders = new InMemorySalesOrderRepository();
  const arCustomerRead = new InMemoryArCustomerReadPort(uow.invoices);
  const customerProfiles = new InMemoryCustomerArProfileReadPort(customers);
  const arOrgRead = new InMemoryArOrgReadPort(uow.invoices, customerProfiles);
  const openOrderExposure = new InMemoryOpenOrderExposureReadAdapter(salesOrders);
  const availableCreditRead = new AvailableCreditReadAdapter(
    arCustomerRead,
    customerProfiles,
    openOrderExposure,
  );
  const lastOrderDate = new InMemoryLastOrderDateReadPort();
  const customerBalancesList = new InMemoryCustomerBalancesListQuery(
    arOrgRead,
    customerProfiles,
    openOrderExposure,
  );
  const paymentsReceivedList = new InMemoryPaymentsReceivedListQuery(
    uow.invoices,
    customerProfiles,
  );

  return {
    uow,
    customers,
    salesOrders,
    recordPayment: new RecordCustomerPaymentUseCase(uow),
    adjustInvoice: new AdjustInvoiceUseCase(uow, clock),
    voidPayment: new VoidPaymentUseCase(uow),
    setPaymentPlan: new SetPaymentPlanUseCase(uow),
    getCustomerSummary: new GetCustomerAccountingSummaryUseCase(
      arCustomerRead,
      customerProfiles,
      openOrderExposure,
      lastOrderDate,
    ),
    availableCreditRead,
    getAccountingSummary: new GetAccountingSummaryUseCase(arOrgRead),
    listCustomerBalances: new ListCustomerBalancesQuery(customerBalancesList),
    listPaymentsReceived: new ListPaymentsReceivedQuery(paymentsReceivedList),
    lastOrderDate,
    openOrderExposure,
  };
}

async function seedCustomer(
  customers: InMemoryCustomerRepository,
  input: {
    id: CustomerId;
    name: string;
    number: string;
    creditLimitCents: number;
  },
) {
  await customers.save({
    id: input.id,
    organizationId: DEFAULT_ORG,
    name: input.name,
    customerNumber: input.number,
    creditLimit: Money.fromMinorUnits(input.creditLimitCents, "USD"),
    terms: "Net 30",
    taxId: null,
    accountStatus: "active",
    customerNote: null,
    staffNote: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  });
}

async function seedInvoice(
  h: Awaited<ReturnType<typeof readHarness>>,
  input: {
    id: string;
    orderId: string;
    customerId: CustomerId;
    totalCents: number;
    dueDate: Date;
    postedAt?: Date;
  },
) {
  const total = Money.fromMinorUnits(input.totalCents, "USD");
  await h.uow.invoices.save({
    id: InvoiceId.parse(input.id),
    organizationId: DEFAULT_ORG,
    orderId: OrderId.parse(input.orderId),
    customerId: input.customerId,
    documentNumber: `INV-${input.id.slice(-2)}`,
    status: "posted",
    postedAt: input.postedAt ?? new Date("2026-01-15T00:00:00.000Z"),
    billLine1: null,
    billLine2: null,
    billCity: null,
    billRegion: null,
    billPostal: null,
    billCountry: null,
    dueDate: input.dueDate,
    terms: "Net 30",
    subtotal: total,
    taxTotal: Money.fromMinorUnits(0, "USD"),
    total,
  });
  return InvoiceId.parse(input.id);
}

async function seedReadModelFixture(h: Awaited<ReturnType<typeof readHarness>>) {
  await seedCustomer(h.customers, {
    id: CUSTOMER_OPEN,
    name: "Open Flowers",
    number: "100001",
    creditLimitCents: 50_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_PARTIAL,
    name: "Partial Petals",
    number: "100002",
    creditLimitCents: 40_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_PAST_DUE,
    name: "Past Due Plants",
    number: "100003",
    creditLimitCents: 30_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_PAID,
    name: "Paid Posies",
    number: "100004",
    creditLimitCents: 20_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_VOIDED,
    name: "Voided Violets",
    number: "100005",
    creditLimitCents: 25_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_ADJUSTED,
    name: "Adjusted Arrangements",
    number: "100006",
    creditLimitCents: 35_000,
  });
  await seedCustomer(h.customers, {
    id: CUSTOMER_CREDIT,
    name: "Credit Corner",
    number: "100007",
    creditLimitCents: 15_000,
  });

  const openInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
    customerId: CUSTOMER_OPEN,
    totalCents: 1200,
    dueDate: new Date("2026-10-01T00:00:00.000Z"),
  });
  const partialInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
    customerId: CUSTOMER_PARTIAL,
    totalCents: 2000,
    dueDate: new Date("2026-10-15T00:00:00.000Z"),
  });
  const pastDueInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc03",
    customerId: CUSTOMER_PAST_DUE,
    totalCents: 3000,
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
  });
  const paidInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc04",
    customerId: CUSTOMER_PAID,
    totalCents: 1500,
    dueDate: new Date("2026-07-01T00:00:00.000Z"),
  });
  const voidedInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc05",
    customerId: CUSTOMER_VOIDED,
    totalCents: 1800,
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
  });
  const adjustedInvoice = await seedInvoice(h, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc06",
    customerId: CUSTOMER_ADJUSTED,
    totalCents: 2500,
    dueDate: new Date("2026-10-20T00:00:00.000Z"),
  });

  await h.recordPayment.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_PARTIAL,
    amountCents: 800,
    currency: "USD",
    method: "check",
    reference: "1002",
    note: "partial check from walk-in",
    receivedAt: new Date("2026-08-20T00:00:00.000Z"),
    idempotencyKey: "partial-payment",
    holdRemainderAsCredit: false,
    applications: [{ invoiceId: partialInvoice, amountCents: 800 }],
  });
  await h.recordPayment.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_PAID,
    amountCents: 1500,
    currency: "USD",
    method: "ach",
    receivedAt: new Date("2026-08-01T00:00:00.000Z"),
    idempotencyKey: "paid-payment",
    holdRemainderAsCredit: false,
    applications: [{ invoiceId: paidInvoice, amountCents: 1500 }],
  });
  const voidedPayment = await h.recordPayment.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_VOIDED,
    amountCents: 1800,
    currency: "USD",
    method: "card",
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    idempotencyKey: "voided-payment",
    holdRemainderAsCredit: false,
    applications: [{ invoiceId: voidedInvoice, amountCents: 1800 }],
  });
  if (voidedPayment.ok) {
    await h.voidPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      paymentId: voidedPayment.paymentId,
      voidReason: "entered in error",
    });
  }
  await h.adjustInvoice.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    invoiceId: adjustedInvoice,
    kind: "credit_memo",
    amountCents: 500,
    reason: "damaged goods",
  });
  await h.recordPayment.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_CREDIT,
    amountCents: 900,
    currency: "USD",
    method: "cash",
    receivedAt: new Date("2026-09-01T00:00:00.000Z"),
    idempotencyKey: "credit-hold",
    holdRemainderAsCredit: true,
    applications: [],
  });
  await h.setPaymentPlan.execute({
    staffUserId: STAFF_ID,
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_PAST_DUE,
    installmentAmountCents: 1000,
    currency: "USD",
    frequency: "monthly",
    startsOn: new Date("2026-09-01T00:00:00.000Z"),
  });

  h.lastOrderDate.setLastOrderDate(
    DEFAULT_ORG,
    CUSTOMER_OPEN,
    new Date("2026-08-30T00:00:00.000Z"),
  );
  await h.salesOrders.save({
    id: OrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddd01"),
    organizationId: DEFAULT_ORG,
    customerId: CUSTOMER_OPEN,
    documentNumber: "SO-0001",
    status: "confirmed",
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
    lines: [
      {
        id: SalesOrderLineId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01"),
        sku: Sku.parse("SKU-OPEN"),
        name: "Open exposure line",
        qty: 1,
        unitPrice: Money.fromMinorUnits(500, "USD"),
      },
    ],
  });

  return {
    openInvoice,
    partialInvoice,
    pastDueInvoice,
    paidInvoice,
    voidedInvoice,
    adjustedInvoice,
  };
}

describe("AR read model (ADA-360)", () => {
  it("available credit read matches customer summary availableCreditCents", async () => {
    const h = await readHarness();
    await seedReadModelFixture(h);

    for (const customerId of [
      CUSTOMER_OPEN,
      CUSTOMER_PARTIAL,
      CUSTOMER_PAST_DUE,
      CUSTOMER_PAID,
      CUSTOMER_VOIDED,
      CUSTOMER_ADJUSTED,
      CUSTOMER_CREDIT,
    ]) {
      const summary = await h.getCustomerSummary.execute({
        organizationId: DEFAULT_ORG,
        customerId,
        asOf: AS_OF,
      });
      const availableCredit = await h.availableCreditRead.getAvailableCreditCents({
        organizationId: DEFAULT_ORG,
        customerId,
        asOf: AS_OF,
      });
      expect(availableCredit).toBe(summary.availableCreditCents);
    }
  });

  it("customer summary covers open, partial, past-due, paid, voided, adjusted, and credit-held cases", async () => {
    const h = await readHarness();
    await seedReadModelFixture(h);

    const openSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_OPEN,
      asOf: AS_OF,
    });
    expect(openSummary.openInvoices).toHaveLength(1);
    expect(openSummary.openInvoices[0]?.status).toBe("open");
    expect(openSummary.openInvoices[0]?.remainingCents).toBe(1200);
    expect(openSummary.openBalanceOwedCents).toBe(1200);
    expect(openSummary.exposureCents).toBe(1700);
    expect(openSummary.availableCreditCents).toBe(48_300);
    expect(openSummary.stats.dateOfLastOrder?.toISOString()).toBe(
      "2026-08-30T00:00:00.000Z",
    );

    const partialSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_PARTIAL,
      asOf: AS_OF,
    });
    expect(partialSummary.openInvoices[0]?.status).toBe("partial");
    expect(partialSummary.openInvoices[0]?.remainingCents).toBe(1200);
    expect(partialSummary.recentPayments[0]?.appliedCents).toBe(800);

    const pastDueSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_PAST_DUE,
      asOf: AS_OF,
    });
    expect(pastDueSummary.openInvoices[0]?.status).toBe("past_due");
    expect(pastDueSummary.plan).not.toBeNull();
    expect(pastDueSummary.planExpectations?.installmentsExpectedSoFar).toBeGreaterThan(0);
    expect(pastDueSummary.aging["90+"]).toBe(0);
    expect(pastDueSummary.aging["31-45"] + pastDueSummary.aging["46-60"]).toBeGreaterThan(0);

    const paidSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_PAID,
      asOf: AS_OF,
    });
    expect(paidSummary.openInvoices).toHaveLength(0);
    expect(paidSummary.openBalanceCents).toBe(0);

    const voidedSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_VOIDED,
      asOf: AS_OF,
    });
    expect(voidedSummary.openInvoices[0]?.remainingCents).toBe(1800);
    expect(voidedSummary.recentPayments[0]?.voided).toBe(true);
    expect(voidedSummary.recentPayments[0]?.unappliedCents).toBe(0);

    const adjustedSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ADJUSTED,
      asOf: AS_OF,
    });
    expect(adjustedSummary.openInvoices[0]?.status).toBe("partial");
    expect(adjustedSummary.openInvoices[0]?.remainingCents).toBe(2000);
    expect(adjustedSummary.stats.creditMemoCount).toBe(1);
    expect(adjustedSummary.stats.totalCreditMemoCents).toBe(500);

    const creditSummary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_CREDIT,
      asOf: AS_OF,
    });
    expect(creditSummary.openInvoices).toHaveLength(0);
    expect(creditSummary.unappliedCreditCents).toBe(900);
    expect(creditSummary.openBalanceCents).toBe(-900);
  });

  it("past asOf excludes invoices posted after asOf and adjustments created after asOf", async () => {
    const h = await readHarness();
    await seedCustomer(h.customers, {
      id: CUSTOMER_OPEN,
      name: "As-Of Invoice Flowers",
      number: "100098",
      creditLimitCents: 10_000,
    });
    const futureInvoiceId = await seedInvoice(h, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb098",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc98",
      customerId: CUSTOMER_OPEN,
      totalCents: 500,
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
      postedAt: new Date("2026-09-15T00:00:00.000Z"),
    });
    const currentInvoiceId = await seedInvoice(h, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb097",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc97",
      customerId: CUSTOMER_OPEN,
      totalCents: 800,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
      postedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId: currentInvoiceId,
      kind: "credit_memo",
      amountCents: 100,
      reason: "future credit",
    });
    await h.uow.invoices.insertAdjustment({
      id: InvoiceAdjustmentId.parse("ffffffff-ffff-4fff-8fff-fffffffffff1"),
      organizationId: DEFAULT_ORG,
      invoiceId: currentInvoiceId,
      kind: "credit_memo",
      amountCents: 200,
      currency: "USD",
      reason: "backdated credit",
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
      createdBy: STAFF_ID,
    });

    const asOf = new Date("2026-09-01T00:00:00.000Z");
    const summary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_OPEN,
      asOf,
    });
    expect(summary.openInvoices).toHaveLength(1);
    expect(summary.openInvoices[0]?.invoice.id).toBe(currentInvoiceId);
    expect(summary.openInvoices[0]?.remainingCents).toBe(600);
    expect(summary.openInvoices.map((row) => row.invoice.id)).not.toContain(futureInvoiceId);
  });

  it("past asOf excludes a payment received after asOf", async () => {
    const h = await readHarness();
    await seedCustomer(h.customers, {
      id: CUSTOMER_OPEN,
      name: "As-Of Flowers",
      number: "100099",
      creditLimitCents: 10_000,
    });
    const invoiceId = await seedInvoice(h, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb099",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc99",
      customerId: CUSTOMER_OPEN,
      totalCents: 1000,
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    await h.recordPayment.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_OPEN,
      amountCents: 400,
      currency: "USD",
      method: "check",
      receivedAt: new Date("2026-09-15T00:00:00.000Z"),
      idempotencyKey: "future-payment-read",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId, amountCents: 400 }],
    });

    const asOf = new Date("2026-09-01T00:00:00.000Z");
    const summary = await h.getCustomerSummary.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_OPEN,
      asOf,
    });
    expect(summary.openInvoices[0]?.remainingCents).toBe(1000);
    expect(summary.openInvoices[0]?.status).toBe("past_due");
    expect(summary.recentPayments).toHaveLength(0);
  });

  it("business summary totals and customer balances list align with customer projections", async () => {
    const h = await readHarness();
    await seedReadModelFixture(h);

    const businessSummary = await h.getAccountingSummary.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
    });
    expect(businessSummary.totalOpenArCents).toBeGreaterThan(0);
    expect(businessSummary.pastDueCents).toBe(4800);
    expect(businessSummary.unappliedCreditCents).toBe(900);
    expect(businessSummary.pastDuePercent).toBeGreaterThan(0);

    const balances = await h.listCustomerBalances.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
      page: 1,
      pageSize: 20,
      sortBy: "pastDue",
      sortOrder: "desc",
    });
    expect(balances.total).toBe(6);
    expect(balances.items[0]?.customerId).toBe(CUSTOMER_PAST_DUE);
    expect(balances.items.some((row) => row.customerId === CUSTOMER_CREDIT)).toBe(true);
    expect(balances.items.find((row) => row.customerId === CUSTOMER_PAID)).toBeUndefined();

    const bucketFiltered = await h.listCustomerBalances.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
      bucket: "31-45",
      page: 1,
      pageSize: 20,
    });
    expect(bucketFiltered.items.every((row) => row.pastDueCents > 0)).toBe(true);

    const search = await h.listCustomerBalances.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
      q: "credit",
      page: 1,
      pageSize: 20,
    });
    expect(search.items).toHaveLength(1);
    expect(search.items[0]?.customerNumber).toBe("100007");
  });

  it("business summary MTD write-offs include customers cleared by write-off", async () => {
    const h = await readHarness();
    const clearedCustomer = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08");
    await seedCustomer(h.customers, {
      id: clearedCustomer,
      name: "Cleared By Write-Off",
      number: "100008",
      creditLimitCents: 10_000,
    });
    const invoiceId = await seedInvoice(h, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccc08",
      customerId: clearedCustomer,
      totalCents: 1500,
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      postedAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    await h.adjustInvoice.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      invoiceId,
      kind: "write_off",
      amountCents: 1500,
      reason: "uncollectible",
    });

    const summary = await h.getAccountingSummary.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
    });
    expect(summary.mtdWriteOffsCents).toBe(1500);
    expect(summary.totalOpenArCents).toBe(0);
    const balances = await h.listCustomerBalances.execute({
      organizationId: DEFAULT_ORG,
      asOf: AS_OF,
      page: 1,
      pageSize: 20,
    });
    expect(balances.items.find((row) => row.customerId === clearedCustomer)).toBeUndefined();
  });

  it("payments received list returns applied, unapplied, and voided rows", async () => {
    const h = await readHarness();
    await seedReadModelFixture(h);

    const payments = await h.listPaymentsReceived.execute({
      organizationId: DEFAULT_ORG,
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
      page: 1,
      pageSize: 20,
      sortBy: "receivedAt",
      sortOrder: "desc",
    });
    expect(payments.total).toBe(4);
    const voided = payments.items.find((row) => row.customerName === "Voided Violets");
    expect(voided?.voided).toBe(true);
    expect(voided?.appliedCents).toBe(1800);
    expect(voided?.voidReason).toBe("entered in error");
    expect(voided?.note).toBeNull();
    const credit = payments.items.find((row) => row.customerName === "Credit Corner");
    expect(credit?.unappliedCents).toBe(900);
    expect(credit?.applications).toEqual([]);
    const partial = payments.items.find((row) => row.customerName === "Partial Petals");
    expect(partial?.note).toBe("partial check from walk-in");
    expect(partial?.voidReason).toBeNull();
    expect(partial?.applications).toHaveLength(1);
    expect(partial?.applications[0]?.amountCents).toBe(800);
  });
});
