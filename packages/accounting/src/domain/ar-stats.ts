import type { InvoiceId } from "@dc-inventory/shared-kernel";
import type { PaymentId } from "./ids.js";
import type {
  ArAsOfContext,
  Invoice,
  InvoiceAdjustment,
  Payment,
  PaymentApplication,
} from "./invoice.js";
import {
  computeAppliedCents,
  computeAdjustmentTotalCents,
  computeRemainingCents,
  filterAdjustmentsForAsOf,
  isInvoicePostedAsOf,
  isPaymentVoided,
} from "./invoice.js";

export type CustomerArStats = {
  readonly highestInvoiceCents: number;
  readonly avgInvoiceCents: number;
  readonly openInvoiceCount: number;
  readonly totalOpenInvoiceAmountCents: number;
  readonly creditMemoCount: number;
  readonly totalCreditMemoCents: number;
  readonly totalWriteOffsCents: number;
  readonly openBalanceCents: number;
  readonly creditLimitCents: number;
  readonly availableCreditCents: number;
  readonly unappliedCreditCents: number;
  readonly dateOfFirstShipment: Date | null;
  readonly dateOfLastShipment: Date | null;
  readonly dateOfLastOrder: Date | null;
  readonly avgDaysToPay: number | null;
  readonly lastYtdSalesCents: number;
  readonly ytdSalesCents: number;
  readonly lytdVsYtdPercent: number | null;
  readonly lastYearSalesCents: number;
  readonly totalSalesCents: number;
};

function startOfUtcYear(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}

function endOfUtcYear(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

function isInPeriod(value: Date, from: Date, to: Date): boolean {
  return value >= from && value <= to;
}

function computeSalesForPeriod(
  invoices: readonly Invoice[],
  adjustmentsByInvoiceId: ReadonlyMap<InvoiceId, readonly InvoiceAdjustment[]>,
  from: Date,
  to: Date,
): number {
  let total = 0;
  for (const invoice of invoices) {
    if (invoice.postedAt === null || !isInPeriod(invoice.postedAt, from, to)) {
      continue;
    }
    total += invoice.total.amountMinor;
    const adjustments = adjustmentsByInvoiceId.get(invoice.id) ?? [];
    for (const adjustment of adjustments) {
      if (adjustment.kind === "credit_memo") {
        total -= adjustment.amountCents;
      }
    }
  }
  return total;
}

function findPaymentReceivedAtThatPaidInvoice(
  invoice: Invoice,
  applications: readonly PaymentApplication[],
  adjustments: readonly InvoiceAdjustment[],
  paymentsById: ReadonlyMap<PaymentId, Payment>,
  voidedPaymentIds: ReadonlySet<PaymentId>,
): Date | null {
  const totalCents = invoice.total.amountMinor;
  const adjustmentTotal = computeAdjustmentTotalCents(adjustments);
  const targetApplied = totalCents - adjustmentTotal;
  if (targetApplied <= 0) {
    return invoice.postedAt;
  }

  const sortedApplications = [...applications]
    .filter((application) => !voidedPaymentIds.has(application.paymentId))
    .sort((left, right) => {
      const leftPayment = paymentsById.get(left.paymentId);
      const rightPayment = paymentsById.get(right.paymentId);
      const leftReceived = leftPayment?.receivedAt?.getTime() ?? 0;
      const rightReceived = rightPayment?.receivedAt?.getTime() ?? 0;
      return leftReceived - rightReceived;
    });

  let runningApplied = 0;
  for (const application of sortedApplications) {
    runningApplied += application.amount.amountMinor;
    if (runningApplied >= targetApplied) {
      const payment = paymentsById.get(application.paymentId);
      return payment?.receivedAt ?? null;
    }
  }
  return null;
}

export function computeCustomerArStats(input: {
  invoices: readonly Invoice[];
  applicationsByInvoiceId: ReadonlyMap<InvoiceId, readonly PaymentApplication[]>;
  adjustmentsByInvoiceId: ReadonlyMap<InvoiceId, readonly InvoiceAdjustment[]>;
  payments: readonly Payment[];
  applicationsByPaymentId: ReadonlyMap<PaymentId, readonly PaymentApplication[]>;
  asOf: Date;
  asOfContext: ArAsOfContext;
  voidedPaymentIds: ReadonlySet<PaymentId>;
  openBalanceCents: number;
  unappliedCreditCents: number;
  availableCreditCents: number;
  creditLimitCents: number;
  lastOrderDate: Date | null;
}): CustomerArStats {
  const {
    invoices,
    applicationsByInvoiceId,
    adjustmentsByInvoiceId,
    payments,
    applicationsByPaymentId,
    asOf,
    asOfContext,
    voidedPaymentIds,
    openBalanceCents,
    unappliedCreditCents,
    availableCreditCents,
    creditLimitCents,
    lastOrderDate,
  } = input;

  const postedInvoices = invoices.filter((invoice) => isInvoicePostedAsOf(invoice, asOf));

  let highestInvoiceCents = 0;
  let invoiceTotalSum = 0;
  let openInvoiceCount = 0;
  let totalOpenInvoiceAmountCents = 0;
  let creditMemoCount = 0;
  let totalCreditMemoCents = 0;
  let totalWriteOffsCents = 0;
  let dateOfFirstShipment: Date | null = null;
  let dateOfLastShipment: Date | null = null;

  const paidDays: number[] = [];

  for (const invoice of postedInvoices) {
    const applications = applicationsByInvoiceId.get(invoice.id) ?? [];
    const adjustments = filterAdjustmentsForAsOf(
      adjustmentsByInvoiceId.get(invoice.id) ?? [],
      asOf,
    );
    const remaining = computeRemainingCents(
      invoice,
      applications,
      voidedPaymentIds,
      adjustments,
      asOfContext,
    );

    highestInvoiceCents = Math.max(highestInvoiceCents, invoice.total.amountMinor);
    invoiceTotalSum += invoice.total.amountMinor;

    if (invoice.postedAt !== null) {
      if (dateOfFirstShipment === null || invoice.postedAt < dateOfFirstShipment) {
        dateOfFirstShipment = invoice.postedAt;
      }
      if (dateOfLastShipment === null || invoice.postedAt > dateOfLastShipment) {
        dateOfLastShipment = invoice.postedAt;
      }
    }

    if (remaining > 0) {
      openInvoiceCount += 1;
      totalOpenInvoiceAmountCents += remaining;
    }

    for (const adjustment of adjustments) {
      if (adjustment.kind === "credit_memo" && adjustment.amountCents > 0) {
        creditMemoCount += 1;
        totalCreditMemoCents += adjustment.amountCents;
      }
      if (adjustment.kind === "write_off" && adjustment.amountCents > 0) {
        totalWriteOffsCents += adjustment.amountCents;
      }
    }

    if (remaining <= 0 && invoice.postedAt !== null) {
      const paidAt = findPaymentReceivedAtThatPaidInvoice(
        invoice,
        applications,
        adjustments,
        asOfContext.paymentsById,
        voidedPaymentIds,
      );
      if (paidAt !== null) {
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.max(
          0,
          Math.floor((paidAt.getTime() - invoice.postedAt.getTime()) / dayMs),
        );
        paidDays.push(days);
      }
    }
  }

  const avgInvoiceCents =
    postedInvoices.length > 0 ? Math.round(invoiceTotalSum / postedInvoices.length) : 0;
  const avgDaysToPay =
    paidDays.length > 0
      ? Math.round(paidDays.reduce((sum, days) => sum + days, 0) / paidDays.length)
      : null;

  const yearStart = startOfUtcYear(asOf);
  const lastYearStart = startOfUtcYear(
    new Date(Date.UTC(asOf.getUTCFullYear() - 1, asOf.getUTCMonth(), asOf.getUTCDate())),
  );
  const lastYearSameDay = new Date(
    Date.UTC(asOf.getUTCFullYear() - 1, asOf.getUTCMonth(), asOf.getUTCDate(), 23, 59, 59, 999),
  );
  const lastYearEnd = endOfUtcYear(lastYearStart);

  const ytdSalesCents = computeSalesForPeriod(
    postedInvoices,
    adjustmentsByInvoiceId,
    yearStart,
    asOf,
  );
  const lastYtdSalesCents = computeSalesForPeriod(
    postedInvoices,
    adjustmentsByInvoiceId,
    lastYearStart,
    lastYearSameDay,
  );
  const lastYearSalesCents = computeSalesForPeriod(
    postedInvoices,
    adjustmentsByInvoiceId,
    lastYearStart,
    lastYearEnd,
  );
  const totalSalesCents = computeSalesForPeriod(
    postedInvoices,
    adjustmentsByInvoiceId,
    new Date(0),
    asOf,
  );

  const lytdVsYtdPercent =
    lastYtdSalesCents > 0
      ? Math.round(((ytdSalesCents - lastYtdSalesCents) / lastYtdSalesCents) * 100)
      : null;

  void payments;
  void applicationsByPaymentId;

  return {
    highestInvoiceCents,
    avgInvoiceCents,
    openInvoiceCount,
    totalOpenInvoiceAmountCents,
    creditMemoCount,
    totalCreditMemoCents,
    totalWriteOffsCents,
    openBalanceCents,
    creditLimitCents,
    availableCreditCents,
    unappliedCreditCents,
    dateOfFirstShipment,
    dateOfLastShipment,
    dateOfLastOrder: lastOrderDate,
    avgDaysToPay,
    lastYtdSalesCents,
    ytdSalesCents,
    lytdVsYtdPercent,
    lastYearSalesCents,
    totalSalesCents,
  };
}

export function computeMtdWriteOffsCents(
  invoices: readonly Invoice[],
  adjustmentsByInvoiceId: ReadonlyMap<InvoiceId, readonly InvoiceAdjustment[]>,
  asOf: Date,
): number {
  const monthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  let total = 0;
  for (const invoice of invoices) {
    const adjustments = adjustmentsByInvoiceId.get(invoice.id) ?? [];
    for (const adjustment of adjustments) {
      if (
        adjustment.kind === "write_off" &&
        adjustment.amountCents > 0 &&
        adjustment.createdAt >= monthStart &&
        adjustment.createdAt <= asOf
      ) {
        total += adjustment.amountCents;
      }
    }
  }
  return total;
}
