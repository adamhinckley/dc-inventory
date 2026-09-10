import type { CustomerId, InvoiceId } from "@dc-inventory/shared-kernel";
import type { PaymentId } from "./ids.js";
import type {
  ArAsOfContext,
  Invoice,
  InvoiceAdjustment,
  Payment,
  PaymentApplication,
  PaymentPlan,
} from "./invoice.js";
import type { ArInvoiceStatus } from "./invoice.js";
import {
  computeAgingBuckets,
  computeDaysPastDue,
  computeOpenBalanceCents,
  computeRemainingCents,
  computeSumRemainingCents,
  computeUnappliedCents,
  computeUnappliedCreditCents,
  deriveInvoiceStatus,
  filterAdjustmentsForAsOf,
  isInvoicePostedAsOf,
  isPaymentVoided,
} from "./invoice.js";

export type CustomerArLoadedData = {
  readonly invoices: readonly Invoice[];
  readonly applicationsByInvoiceId: ReadonlyMap<
    InvoiceId,
    readonly PaymentApplication[]
  >;
  readonly adjustmentsByInvoiceId: ReadonlyMap<
    InvoiceId,
    readonly InvoiceAdjustment[]
  >;
  readonly payments: readonly Payment[];
  readonly applicationsByPaymentId: ReadonlyMap<
    PaymentId,
    readonly PaymentApplication[]
  >;
  readonly activePlan: PaymentPlan | null;
};

export function buildArAsOfContext(
  payments: readonly Payment[],
  asOf: Date,
): ArAsOfContext {
  return {
    asOf,
    paymentsById: new Map(payments.map((payment) => [payment.id, payment])),
  };
}

export function collectVoidedPaymentIds(
  payments: readonly Payment[],
): ReadonlySet<PaymentId> {
  return new Set(payments.filter((payment) => isPaymentVoided(payment)).map((payment) => payment.id));
}

export function filterCustomerArDataForAsOf(
  data: CustomerArLoadedData,
  asOf: Date,
): CustomerArLoadedData {
  const invoices = data.invoices.filter((invoice) => isInvoicePostedAsOf(invoice, asOf));
  const payments = data.payments.filter(
    (payment) => payment.receivedAt !== undefined && payment.receivedAt <= asOf,
  );
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const paymentIds = new Set(payments.map((payment) => payment.id));

  const applicationsByInvoiceId = new Map<
    InvoiceId,
    readonly PaymentApplication[]
  >();
  for (const [invoiceId, applications] of data.applicationsByInvoiceId) {
    if (!invoiceIds.has(invoiceId)) {
      continue;
    }
    applicationsByInvoiceId.set(
      invoiceId,
      applications.filter((application) => paymentIds.has(application.paymentId)),
    );
  }

  const adjustmentsByInvoiceId = new Map<
    InvoiceId,
    readonly InvoiceAdjustment[]
  >();
  for (const [invoiceId, adjustments] of data.adjustmentsByInvoiceId) {
    if (!invoiceIds.has(invoiceId)) {
      continue;
    }
    adjustmentsByInvoiceId.set(
      invoiceId,
      filterAdjustmentsForAsOf(adjustments, asOf),
    );
  }

  const applicationsByPaymentId = new Map<
    PaymentId,
    readonly PaymentApplication[]
  >();
  for (const [paymentId, applications] of data.applicationsByPaymentId) {
    if (!paymentIds.has(paymentId)) {
      continue;
    }
    applicationsByPaymentId.set(
      paymentId,
      applications.filter((application) => invoiceIds.has(application.invoiceId)),
    );
  }

  const activePlan =
    data.activePlan !== null &&
    (data.activePlan.endedAt === null || data.activePlan.endedAt > asOf)
      ? data.activePlan
      : null;

  return {
    invoices,
    applicationsByInvoiceId,
    adjustmentsByInvoiceId,
    payments,
    applicationsByPaymentId,
    activePlan,
  };
}

export type CustomerArBalanceProjection = {
  readonly customerId: CustomerId;
  readonly sumRemainingCents: number;
  readonly unappliedCreditCents: number;
  readonly openBalanceCents: number;
  readonly pastDueCents: number;
  readonly oldestDueDate: Date | null;
  readonly daysPastDue: number;
  readonly aging: Readonly<Record<import("./invoice.js").AgingBucket, number>>;
  readonly hasActivePlan: boolean;
};

export function projectCustomerArBalance(
  customerId: CustomerId,
  data: CustomerArLoadedData,
  asOf: Date,
): CustomerArBalanceProjection {
  const filtered = filterCustomerArDataForAsOf(data, asOf);
  const voidedPaymentIds = collectVoidedPaymentIds(filtered.payments);
  const asOfContext = buildArAsOfContext(filtered.payments, asOf);

  const sumRemainingCents = computeSumRemainingCents(
    filtered.invoices,
    filtered.applicationsByInvoiceId,
    filtered.adjustmentsByInvoiceId,
    voidedPaymentIds,
    asOfContext,
  );
  const unappliedCreditCents = computeUnappliedCreditCents(
    filtered.payments,
    filtered.applicationsByPaymentId,
    asOf,
  );
  const openBalanceCents = computeOpenBalanceCents(
    filtered.invoices,
    filtered.applicationsByInvoiceId,
    filtered.adjustmentsByInvoiceId,
    filtered.payments,
    filtered.applicationsByPaymentId,
    voidedPaymentIds,
    asOfContext,
  );

  let pastDueCents = 0;
  let oldestDueDate: Date | null = null;
  let daysPastDue = 0;
  for (const invoice of filtered.invoices) {
    const applications = filtered.applicationsByInvoiceId.get(invoice.id) ?? [];
    const adjustments = filtered.adjustmentsByInvoiceId.get(invoice.id) ?? [];
    const remaining = computeRemainingCents(
      invoice,
      applications,
      voidedPaymentIds,
      adjustments,
      asOfContext,
    );
    if (remaining <= 0) {
      continue;
    }
    const invoiceDaysPastDue = computeDaysPastDue(invoice.dueDate, asOf);
    if (invoiceDaysPastDue > 0) {
      pastDueCents += remaining;
      if (
        invoice.dueDate !== null &&
        (oldestDueDate === null || invoice.dueDate < oldestDueDate)
      ) {
        oldestDueDate = invoice.dueDate;
        daysPastDue = invoiceDaysPastDue;
      }
    }
  }

  const aging = computeAgingBuckets(
    filtered.invoices,
    filtered.applicationsByInvoiceId,
    filtered.adjustmentsByInvoiceId,
    asOf,
    voidedPaymentIds,
    asOfContext,
  );

  return {
    customerId,
    sumRemainingCents,
    unappliedCreditCents,
    openBalanceCents,
    pastDueCents,
    oldestDueDate,
    daysPastDue,
    aging,
    hasActivePlan: filtered.activePlan !== null,
  };
}

export function customerHasBalanceOrCredit(projection: CustomerArBalanceProjection): boolean {
  return projection.openBalanceCents > 0 || projection.unappliedCreditCents > 0;
}

export type CustomerInvoiceProjectionRow = {
  readonly invoice: Invoice;
  readonly remainingCents: number;
  readonly status: ArInvoiceStatus;
};

export type CustomerPaymentProjectionRow = {
  readonly payment: Payment;
  readonly appliedCents: number;
  readonly unappliedCents: number;
  readonly applications: readonly PaymentApplication[];
  readonly voided: boolean;
};

export function deriveCustomerInvoiceRows(
  data: CustomerArLoadedData,
  asOf: Date,
  includePaid: boolean,
): readonly CustomerInvoiceProjectionRow[] {
  const filtered = filterCustomerArDataForAsOf(data, asOf);
  const voidedPaymentIds = collectVoidedPaymentIds(filtered.payments);
  const asOfContext = buildArAsOfContext(filtered.payments, asOf);

  return filtered.invoices
    .map((invoice) => {
      const applications = filtered.applicationsByInvoiceId.get(invoice.id) ?? [];
      const adjustments = filtered.adjustmentsByInvoiceId.get(invoice.id) ?? [];
      const remainingCents = computeRemainingCents(
        invoice,
        applications,
        voidedPaymentIds,
        adjustments,
        asOfContext,
      );
      if (!includePaid && remainingCents <= 0) {
        return null;
      }
      return {
        invoice,
        remainingCents,
        status: deriveInvoiceStatus(
          invoice,
          applications,
          asOf,
          voidedPaymentIds,
          adjustments,
          asOfContext,
        ),
      };
    })
    .filter((row): row is CustomerInvoiceProjectionRow => row !== null);
}

export function deriveOpenInvoiceRows(
  data: CustomerArLoadedData,
  asOf: Date,
): readonly CustomerInvoiceProjectionRow[] {
  return deriveCustomerInvoiceRows(data, asOf, false);
}

export function deriveCustomerPaymentRows(
  data: CustomerArLoadedData,
  asOf: Date,
): readonly CustomerPaymentProjectionRow[] {
  const filtered = filterCustomerArDataForAsOf(data, asOf);

  return [...filtered.payments]
    .sort((left, right) => {
      const leftReceived = left.receivedAt?.getTime() ?? 0;
      const rightReceived = right.receivedAt?.getTime() ?? 0;
      return rightReceived - leftReceived;
    })
    .map((payment) => {
      const applications = filtered.applicationsByPaymentId.get(payment.id) ?? [];
      const appliedCents = applications.reduce(
        (sum, application) => sum + application.amount.amountMinor,
        0,
      );
      return {
        payment,
        appliedCents,
        unappliedCents: computeUnappliedCents(payment, applications, asOf),
        applications,
        voided: payment.voidedAt != null,
      };
    });
}
