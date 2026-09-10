import type { AccountingPaymentRow } from "./accounting-types";
import type { CustomerPaymentRow } from "./customer-accounting-types";

export type PaymentDetailApplication = {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
};

export type PaymentDetailRecord = {
  id: string;
  customerId: string;
  receivedAt: string;
  amountCents: number;
  currency: string;
  method: CustomerPaymentRow["method"];
  reference: string | null;
  note: string | null;
  appliedCents: number;
  unappliedCents: number;
  voided: boolean;
  voidReason: string | null;
  applications: PaymentDetailApplication[];
};

function mapApplications(
  applications: CustomerPaymentRow["applications"] | AccountingPaymentRow["applications"],
): PaymentDetailApplication[] {
  return applications.map((application) => ({
    id: application.id,
    invoiceId: application.invoiceId,
    amountCents: application.amountCents,
    currency: application.currency,
  }));
}

export function paymentDetailFromCustomerPayment(
  payment: CustomerPaymentRow,
  customerId: string,
): PaymentDetailRecord {
  return {
    id: payment.id,
    customerId,
    receivedAt: payment.receivedAt,
    amountCents: payment.amountCents,
    currency: payment.currency,
    method: payment.method,
    reference: payment.reference,
    note: payment.note,
    appliedCents: payment.appliedCents,
    unappliedCents: payment.unappliedCents,
    voided: payment.voided,
    voidReason: payment.voidReason,
    applications: mapApplications(payment.applications),
  };
}

export function paymentDetailFromAccountingPayment(
  row: AccountingPaymentRow,
): PaymentDetailRecord {
  return {
    id: row.paymentId,
    customerId: row.customerId,
    receivedAt: row.receivedAt,
    amountCents: row.amountCents,
    currency: row.currency,
    method: row.method,
    reference: row.reference,
    note: row.note,
    appliedCents: row.appliedCents,
    unappliedCents: row.unappliedCents,
    voided: row.voided,
    voidReason: row.voidReason,
    applications: mapApplications(row.applications),
  };
}

export function paymentDetailToCustomerRow(
  payment: PaymentDetailRecord,
): CustomerPaymentRow {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    method: payment.method,
    reference: payment.reference,
    note: payment.note,
    receivedAt: payment.receivedAt,
    appliedCents: payment.appliedCents,
    unappliedCents: payment.unappliedCents,
    voided: payment.voided,
    voidReason: payment.voidReason,
    applications: payment.applications.map((application) => ({
      id: application.id,
      invoiceId: application.invoiceId,
      amountCents: application.amountCents,
      currency: application.currency,
      createdAt: payment.receivedAt,
    })),
  };
}

export function paymentDetailText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function paymentApplicationInvoiceLabel(
  invoiceId: string,
  invoiceNumbers: ReadonlyMap<string, string>,
): string {
  return invoiceNumbers.get(invoiceId) ?? "…";
}

export function paymentApplicationLabelsReady(
  applications: readonly PaymentDetailApplication[],
  invoiceNumbers: ReadonlyMap<string, string>,
): boolean {
  return applications.every((application) => invoiceNumbers.has(application.invoiceId));
}
