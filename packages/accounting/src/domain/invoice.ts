import type { Money, StaffUserId } from "@dc-inventory/shared-kernel";
import type { PaymentApplicationId, PaymentId } from "./ids.js";

export const INVOICE_STATUSES = ["unposted", "posted"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const AR_INVOICE_STATUSES = ["paid", "past_due", "partial", "open"] as const;
export type ArInvoiceStatus = (typeof AR_INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["check", "card", "ach", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVOICE_ADJUSTMENT_KINDS = ["write_off", "credit_memo"] as const;
export type InvoiceAdjustmentKind = (typeof INVOICE_ADJUSTMENT_KINDS)[number];

export const PAYMENT_PLAN_FREQUENCIES = ["weekly", "monthly"] as const;
export type PaymentPlanFrequency = (typeof PAYMENT_PLAN_FREQUENCIES)[number];

export const AGING_BUCKETS = [
  "current",
  "1-15",
  "16-30",
  "31-45",
  "46-60",
  "61-90",
  "90+",
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export type PaymentApplication = {
  readonly id: PaymentApplicationId;
  readonly paymentId: PaymentId;
  readonly invoiceId: import("@dc-inventory/shared-kernel").InvoiceId;
  readonly amount: Money;
  readonly createdAt: Date;
};

export type Invoice = {
  readonly id: import("@dc-inventory/shared-kernel").InvoiceId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly orderId: import("@dc-inventory/shared-kernel").OrderId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly documentNumber: string;
  readonly status: InvoiceStatus;
  readonly postedAt: Date | null;
  readonly billLine1: string | null;
  readonly billLine2: string | null;
  readonly billCity: string | null;
  readonly billRegion: string | null;
  readonly billPostal: string | null;
  readonly billCountry: string | null;
  readonly dueDate: Date | null;
  readonly terms: string | null;
  readonly subtotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
};

export type Payment = {
  readonly id: PaymentId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly createdAt: Date;
  readonly method?: PaymentMethod;
  readonly reference?: string | null;
  readonly receivedAt?: Date;
  readonly note?: string | null;
  readonly recordedBy?: StaffUserId;
  readonly voidedAt?: Date | null;
  readonly voidedBy?: StaffUserId | null;
  readonly voidReason?: string | null;
};

export type InvoiceAdjustment = {
  readonly id: import("./ids.js").InvoiceAdjustmentId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly invoiceId: import("@dc-inventory/shared-kernel").InvoiceId;
  readonly kind: InvoiceAdjustmentKind;
  readonly amountCents: number;
  readonly reason: string;
  readonly createdAt: Date;
  readonly createdBy: StaffUserId;
};

export type PaymentPlan = {
  readonly id: import("./ids.js").PaymentPlanId;
  readonly organizationId: import("@dc-inventory/shared-kernel").OrganizationId;
  readonly customerId: import("@dc-inventory/shared-kernel").CustomerId;
  readonly frequency: PaymentPlanFrequency;
  readonly installmentAmountCents: number;
  readonly currency: string;
  readonly startsOn: Date;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly createdBy: StaffUserId;
};

export type PaymentPlanExpectations = {
  readonly nextExpectedOn: Date | null;
  readonly estimatedEndOn: Date | null;
  readonly installmentsReceived: number;
};

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function isPaymentVoided(payment: Payment): boolean {
  return payment.voidedAt != null;
}

export function computeAppliedCents(
  applications: readonly PaymentApplication[],
  voidedPaymentIds: ReadonlySet<PaymentId> = new Set(),
): number {
  return applications.reduce((sum, row) => {
    if (voidedPaymentIds.has(row.paymentId)) {
      return sum;
    }
    return sum + row.amount.amountMinor;
  }, 0);
}

export function computeAdjustmentTotalCents(adjustments: readonly InvoiceAdjustment[]): number {
  return adjustments.reduce((sum, row) => sum + row.amountCents, 0);
}

export function computeRemainingCents(
  invoice: Invoice,
  applications: readonly PaymentApplication[],
  voidedPaymentIds: ReadonlySet<PaymentId> = new Set(),
  adjustments: readonly InvoiceAdjustment[] = [],
): number {
  const applied = computeAppliedCents(applications, voidedPaymentIds);
  const adjustmentTotal = computeAdjustmentTotalCents(adjustments);
  return invoice.total.amountMinor - applied - adjustmentTotal;
}

export function computeDaysPastDue(dueDate: Date | null, asOf: Date): number {
  if (dueDate === null) {
    return 0;
  }
  const dueDay = startOfUtcDay(dueDate);
  const asOfDay = startOfUtcDay(asOf);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((asOfDay.getTime() - dueDay.getTime()) / dayMs);
  return Math.max(0, diffDays);
}

export function deriveInvoiceStatus(
  invoice: Invoice,
  applications: readonly PaymentApplication[],
  asOf: Date,
  voidedPaymentIds: ReadonlySet<PaymentId> = new Set(),
  adjustments: readonly InvoiceAdjustment[] = [],
): ArInvoiceStatus {
  const remaining = computeRemainingCents(invoice, applications, voidedPaymentIds, adjustments);
  if (remaining <= 0) {
    return "paid";
  }
  if (computeDaysPastDue(invoice.dueDate, asOf) > 0) {
    return "past_due";
  }
  const applied = computeAppliedCents(applications, voidedPaymentIds);
  if (applied > 0) {
    return "partial";
  }
  return "open";
}

export function computeAgingBucket(dueDate: Date | null, asOf: Date): AgingBucket {
  const daysPastDue = computeDaysPastDue(dueDate, asOf);
  if (daysPastDue <= 0) {
    return "current";
  }
  if (daysPastDue <= 15) {
    return "1-15";
  }
  if (daysPastDue <= 30) {
    return "16-30";
  }
  if (daysPastDue <= 45) {
    return "31-45";
  }
  if (daysPastDue <= 60) {
    return "46-60";
  }
  if (daysPastDue <= 90) {
    return "61-90";
  }
  return "90+";
}

export function computeAgingBuckets(
  invoices: readonly Invoice[],
  applicationsByInvoiceId: ReadonlyMap<
    import("@dc-inventory/shared-kernel").InvoiceId,
    readonly PaymentApplication[]
  >,
  adjustmentsByInvoiceId: ReadonlyMap<
    import("@dc-inventory/shared-kernel").InvoiceId,
    readonly InvoiceAdjustment[]
  >,
  asOf: Date,
  voidedPaymentIds: ReadonlySet<PaymentId> = new Set(),
): Readonly<Record<AgingBucket, number>> {
  const buckets: Record<AgingBucket, number> = {
    current: 0,
    "1-15": 0,
    "16-30": 0,
    "31-45": 0,
    "46-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const invoice of invoices) {
    const applications = applicationsByInvoiceId.get(invoice.id) ?? [];
    const adjustments = adjustmentsByInvoiceId.get(invoice.id) ?? [];
    const remaining = computeRemainingCents(invoice, applications, voidedPaymentIds, adjustments);
    if (remaining <= 0) {
      continue;
    }
    const bucket = computeAgingBucket(invoice.dueDate, asOf);
    buckets[bucket] += remaining;
  }

  return buckets;
}

export function computeUnappliedCents(
  payment: Payment,
  applications: readonly PaymentApplication[],
): number {
  if (isPaymentVoided(payment)) {
    return 0;
  }
  const applied = applications.reduce((sum, row) => sum + row.amount.amountMinor, 0);
  return payment.amount.amountMinor - applied;
}

function addMonthsUtc(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
}

function addWeeksUtc(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

function advancePlanDate(from: Date, frequency: PaymentPlanFrequency, steps: number): Date {
  if (frequency === "weekly") {
    return addWeeksUtc(from, steps);
  }
  return addMonthsUtc(from, steps);
}

export function computePlanExpectations(
  plan: PaymentPlan,
  openBalanceCents: number,
  asOf: Date,
  payments: readonly Payment[],
): PaymentPlanExpectations {
  if (plan.endedAt !== null && asOf >= plan.endedAt) {
    return {
      nextExpectedOn: null,
      estimatedEndOn: null,
      installmentsReceived: 0,
    };
  }

  const activePayments = payments.filter(
    (payment) =>
      !isPaymentVoided(payment) &&
      payment.receivedAt != null &&
      payment.receivedAt >= plan.startsOn &&
      payment.amount.currency === plan.currency,
  );
  const installmentsReceived = activePayments.filter(
    (payment) => payment.amount.amountMinor >= plan.installmentAmountCents,
  ).length;

  const installmentCount =
    plan.installmentAmountCents > 0
      ? Math.ceil(openBalanceCents / plan.installmentAmountCents)
      : 0;
  const estimatedEndOn =
    installmentCount > 0
      ? advancePlanDate(plan.startsOn, plan.frequency, installmentCount - 1)
      : null;

  let nextExpectedOn: Date | null = null;
  if (openBalanceCents > 0 && (plan.endedAt === null || asOf < plan.endedAt)) {
    let candidate = plan.startsOn;
    while (candidate <= asOf) {
      candidate = advancePlanDate(candidate, plan.frequency, 1);
    }
    nextExpectedOn = candidate;
  }

  return {
    nextExpectedOn,
    estimatedEndOn,
    installmentsReceived,
  };
}
