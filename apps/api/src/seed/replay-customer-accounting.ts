import {
  AdjustInvoiceUseCase,
  RecordCustomerPaymentUseCase,
  SetPaymentPlanUseCase,
  VoidPaymentUseCase,
  computeRemainingCents,
  type AccountingUnitOfWorkWithCustomerPayments,
  type IAccountingRepository,
  type IClock,
  type IInvoiceRepository,
  type Invoice,
} from "@dc-inventory/accounting";
import type { ICustomerRepository } from "@dc-inventory/customers";
import {
  CustomerId,
  OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import {
  CUSTOMER_ACCOUNTING_SHOWCASE_KEY,
  CUSTOMER_ACCOUNTING_SHOWCASE_MIN_INVOICES,
} from "./planner/customer-accounting-showcase.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import { customerIdByKeyFromPlan } from "./replay-sales-orders.js";
import type { DemoBookPlan } from "./planner/types.js";

export class ReplayCustomerAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayCustomerAccountingError";
  }
}

export type PlaybackClock = IClock & {
  setInstant(instant: Date): void;
};

export type ReplayCustomerAccountingPorts = {
  accountingUow: AccountingUnitOfWorkWithCustomerPayments;
  clock: PlaybackClock;
  customers: Pick<ICustomerRepository, "findByName">;
  invoices: Pick<IInvoiceRepository, "list" | "listApplications"> &
    Pick<IAccountingRepository, "listAdjustments">;
};

export type ReplayCustomerAccountingInput = {
  plan: DemoBookPlan;
  staffUserId: StaffUserId;
  assertWithinBudget?: () => void;
};

export type ReplayCustomerAccountingResult = {
  showcaseCustomerId: CustomerId;
  eventCount: number;
};

function assertOk<T extends { ok: boolean; reason?: string }>(
  label: string,
  result: T,
): asserts result is T & { ok: true } {
  if (!result.ok) {
    throw new ReplayCustomerAccountingError(`${label} failed: ${result.reason ?? "unknown"}`);
  }
}

async function postedInvoicesForCustomer(
  invoices: Pick<IInvoiceRepository, "list">,
  customerId: CustomerId,
): Promise<Invoice[]> {
  const rows = await invoices.list(OrganizationId.DEFAULT);
  return rows
    .filter((row) => row.customerId === customerId && row.postedAt !== null)
    .sort((left, right) => {
      const byPosted =
        (left.postedAt?.getTime() ?? 0) - (right.postedAt?.getTime() ?? 0);
      if (byPosted !== 0) {
        return byPosted;
      }
      return left.documentNumber.localeCompare(right.documentNumber);
    });
}

async function remainingCentsForInvoice(
  ports: ReplayCustomerAccountingPorts,
  invoice: Invoice,
): Promise<number> {
  const applications = await ports.invoices.listApplications(invoice.id);
  const adjustments = await ports.invoices.listAdjustments(invoice.id);
  return computeRemainingCents(invoice, applications, new Set(), adjustments);
}

function creditMemoAmount(totalCents: number): number {
  const capped = Math.floor(totalCents * 0.2);
  return Math.max(100, Math.min(5_000, capped));
}

function partialPaymentAmount(remainingCents: number): number {
  if (remainingCents <= 1) {
    throw new ReplayCustomerAccountingError("partial payment target has no remaining balance");
  }
  const half = Math.floor(remainingCents / 2);
  return Math.max(1, Math.min(half, remainingCents - 1));
}

function receivedAtFor(invoice: Invoice, offsetDays: number): Date {
  const base = invoice.postedAt ?? new Date();
  return new Date(base.getTime() + offsetDays * 86_400_000);
}

/**
 * After demo payment replay and reconciliation, enrich Idle Park Distributors so
 * the customer Accounting tab exercises open, partial, paid, past-due, adjusted,
 * voided, unapplied credit, and payment-plan states.
 */
export async function runReplayCustomerAccounting(
  ports: ReplayCustomerAccountingPorts,
  input: ReplayCustomerAccountingInput,
): Promise<ReplayCustomerAccountingResult> {
  const customerIdByKey = await customerIdByKeyFromPlan(input.plan, ports.customers);
  const showcaseCustomerId = customerIdByKey.get(CUSTOMER_ACCOUNTING_SHOWCASE_KEY);
  if (showcaseCustomerId === undefined) {
    throw new ReplayCustomerAccountingError(
      `missing showcase customer key ${CUSTOMER_ACCOUNTING_SHOWCASE_KEY}`,
    );
  }

  const customerInvoices = await postedInvoicesForCustomer(
    ports.invoices,
    showcaseCustomerId,
  );
  if (customerInvoices.length < CUSTOMER_ACCOUNTING_SHOWCASE_MIN_INVOICES) {
    throw new ReplayCustomerAccountingError(
      `${DEMO_NAMED_CUSTOMERS.idlePark.name} needs at least ${String(CUSTOMER_ACCOUNTING_SHOWCASE_MIN_INVOICES)} posted invoices`,
    );
  }

  const adjustedTarget = customerInvoices[0];
  const partialTarget = customerInvoices[1];
  const paidTarget = customerInvoices[2];
  const voidedTarget = customerInvoices[3];
  if (
    adjustedTarget === undefined ||
    partialTarget === undefined ||
    paidTarget === undefined ||
    voidedTarget === undefined
  ) {
    throw new ReplayCustomerAccountingError(
      `${DEMO_NAMED_CUSTOMERS.idlePark.name} is missing showcase invoice slots`,
    );
  }

  const recordPayment = new RecordCustomerPaymentUseCase(ports.accountingUow, ports.clock);
  const adjustInvoice = new AdjustInvoiceUseCase(ports.accountingUow, ports.clock);
  const voidPayment = new VoidPaymentUseCase(ports.accountingUow);
  const setPaymentPlan = new SetPaymentPlanUseCase(ports.accountingUow, ports.clock);

  let eventCount = 0;
  const tick = (): void => {
    input.assertWithinBudget?.();
    eventCount += 1;
  };

  tick();
  ports.clock.setInstant(receivedAtFor(adjustedTarget, 1));
  const adjustedRemainingBefore = await remainingCentsForInvoice(ports, adjustedTarget);
  const memoAmount = creditMemoAmount(adjustedTarget.total.amountMinor);
  if (memoAmount >= adjustedRemainingBefore) {
    throw new ReplayCustomerAccountingError(
      `${adjustedTarget.documentNumber} is too small for a showcase credit memo`,
    );
  }
  assertOk(
    "credit memo",
    await adjustInvoice.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      invoiceId: adjustedTarget.id,
      kind: "credit_memo",
      amountCents: memoAmount,
      reason: "Demo seed damaged-goods credit",
    }),
  );

  tick();
  ports.clock.setInstant(receivedAtFor(partialTarget, 2));
  const partialRemaining = await remainingCentsForInvoice(ports, partialTarget);
  const partialAmount = partialPaymentAmount(partialRemaining);
  assertOk(
    "partial payment",
    await recordPayment.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      customerId: showcaseCustomerId,
      amountCents: partialAmount,
      currency: partialTarget.total.currency,
      method: "check",
      reference: "CHK-DEMO-PARTIAL",
      receivedAt: receivedAtFor(partialTarget, 2),
      idempotencyKey: "demo:customer-accounting:partial",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: partialTarget.id, amountCents: partialAmount }],
    }),
  );

  tick();
  ports.clock.setInstant(receivedAtFor(paidTarget, 3));
  const paidRemaining = await remainingCentsForInvoice(ports, paidTarget);
  assertOk(
    "paid invoice",
    await recordPayment.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      customerId: showcaseCustomerId,
      amountCents: paidRemaining,
      currency: paidTarget.total.currency,
      method: "ach",
      reference: "ACH-DEMO-PAID",
      receivedAt: receivedAtFor(paidTarget, 3),
      idempotencyKey: "demo:customer-accounting:paid",
      holdRemainderAsCredit: false,
      applications: [{ invoiceId: paidTarget.id, amountCents: paidRemaining }],
    }),
  );

  tick();
  ports.clock.setInstant(receivedAtFor(voidedTarget, 4));
  const voidedRemaining = await remainingCentsForInvoice(ports, voidedTarget);
  const voidedPayment = await recordPayment.execute({
    staffUserId: input.staffUserId,
    organizationId: OrganizationId.DEFAULT,
    customerId: showcaseCustomerId,
    amountCents: voidedRemaining,
    currency: voidedTarget.total.currency,
    method: "card",
    reference: "CARD-DEMO-VOID",
    receivedAt: receivedAtFor(voidedTarget, 4),
    idempotencyKey: "demo:customer-accounting:voided",
    holdRemainderAsCredit: false,
    applications: [{ invoiceId: voidedTarget.id, amountCents: voidedRemaining }],
  });
  assertOk("voided payment record", voidedPayment);
  tick();
  assertOk(
    "void payment",
    await voidPayment.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      paymentId: voidedPayment.paymentId,
      voidReason: "Demo seed entered in error",
    }),
  );

  tick();
  ports.clock.setInstant(input.plan.seedToday);
  assertOk(
    "unapplied credit",
    await recordPayment.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      customerId: showcaseCustomerId,
      amountCents: 75_000,
      currency: "USD",
      method: "check",
      reference: "CHK-DEMO-CREDIT",
      note: "Demo prepayment held on account",
      receivedAt: input.plan.seedToday,
      idempotencyKey: "demo:customer-accounting:unapplied-credit",
      holdRemainderAsCredit: true,
      applications: [],
    }),
  );

  tick();
  const planStart = new Date(input.plan.seedToday.getTime() - 45 * 86_400_000);
  ports.clock.setInstant(planStart);
  assertOk(
    "payment plan",
    await setPaymentPlan.execute({
      staffUserId: input.staffUserId,
      organizationId: OrganizationId.DEFAULT,
      customerId: showcaseCustomerId,
      installmentAmountCents: 25_000,
      currency: "USD",
      frequency: "monthly",
      startsOn: planStart,
    }),
  );

  return { showcaseCustomerId, eventCount };
}
