import type { InvoiceId } from "@dc-inventory/shared-kernel";
import { computeRemainingCents } from "../domain/invoice.js";
import type { PaymentIdempotencyRecord, PaymentApplicationSpec } from "../domain/ports/invoice-repository.js";
import type { Payment, PaymentMethod } from "../domain/invoice.js";

export type CustomerPaymentPayload = {
  readonly customerId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly reference: string | null;
  readonly note: string | null;
  readonly receivedAt?: Date;
  readonly holdRemainderAsCredit: boolean;
  readonly applications: readonly PaymentApplicationSpec[];
};

export function normalizePaymentApplications(
  record: PaymentIdempotencyRecord,
): readonly PaymentApplicationSpec[] {
  if (record.applications !== undefined) {
    return record.applications;
  }
  if (record.invoiceId !== undefined && record.applicationAmountCents !== undefined) {
    return [{ invoiceId: record.invoiceId, amountCents: record.applicationAmountCents }];
  }
  return [];
}

export function sameCustomerPaymentPayload(
  existing: PaymentIdempotencyRecord,
  next: CustomerPaymentPayload,
): boolean {
  if ((existing.holdRemainderAsCredit ?? false) !== next.holdRemainderAsCredit) {
    return false;
  }
  if (existing.payment.customerId !== next.customerId) {
    return false;
  }
  if (existing.payment.amount.amountMinor !== next.amountCents) {
    return false;
  }
  if (existing.payment.amount.currency !== next.currency.trim().toUpperCase()) {
    return false;
  }
  if ((existing.payment.method ?? "other") !== next.method) {
    return false;
  }
  if ((existing.payment.reference ?? null) !== next.reference) {
    return false;
  }
  if ((existing.payment.note ?? null) !== next.note) {
    return false;
  }
  if (next.receivedAt !== undefined) {
    const existingReceivedAt = existing.payment.receivedAt;
    if (
      existingReceivedAt === undefined ||
      existingReceivedAt.getTime() !== next.receivedAt.getTime()
    ) {
      return false;
    }
  }
  const existingApplications = normalizePaymentApplications(existing);
  if (existingApplications.length !== next.applications.length) {
    return false;
  }
  const sortedExisting = [...existingApplications].sort((a, b) =>
    compareApplicationSpec(a, b),
  );
  const sortedNext = [...next.applications].sort((a, b) => compareApplicationSpec(a, b));
  for (let index = 0; index < sortedExisting.length; index += 1) {
    const left = sortedExisting[index]!;
    const right = sortedNext[index]!;
    if (left.invoiceId !== right.invoiceId || left.amountCents !== right.amountCents) {
      return false;
    }
  }
  return true;
}

function compareApplicationSpec(a: PaymentApplicationSpec, b: PaymentApplicationSpec): number {
  const byInvoice = String(a.invoiceId).localeCompare(String(b.invoiceId));
  if (byInvoice !== 0) {
    return byInvoice;
  }
  return a.amountCents - b.amountCents;
}

export async function collectVoidedPaymentIds(
  invoices: {
    findPaymentById(
      organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
      paymentId: import("../domain/ids.js").PaymentId,
    ): Promise<Payment | null>;
  },
  organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
  paymentIds: Iterable<import("../domain/ids.js").PaymentId>,
): Promise<Set<import("../domain/ids.js").PaymentId>> {
  const voided = new Set<import("../domain/ids.js").PaymentId>();
  for (const paymentId of paymentIds) {
    const payment = await invoices.findPaymentById(organizationId, paymentId);
    if (payment !== null && payment.voidedAt != null) {
      voided.add(paymentId);
    }
  }
  return voided;
}

export async function remainingForInvoice(
  invoices: {
    findByIdForPayment(
      organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
      id: InvoiceId,
    ): Promise<import("../domain/invoice.js").Invoice | null>;
    listApplications(invoiceId: InvoiceId): Promise<readonly import("../domain/invoice.js").PaymentApplication[]>;
    listAdjustments(
      invoiceId: InvoiceId,
    ): Promise<readonly import("../domain/invoice.js").InvoiceAdjustment[]>;
    findPaymentById(
      organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
      paymentId: import("../domain/ids.js").PaymentId,
    ): Promise<Payment | null>;
  },
  organizationId: import("@dc-inventory/shared-kernel").OrganizationId,
  invoiceId: InvoiceId,
): Promise<number | null> {
  const invoice = await invoices.findByIdForPayment(organizationId, invoiceId);
  if (invoice === null) {
    return null;
  }
  const applications = await invoices.listApplications(invoiceId);
  const adjustments = await invoices.listAdjustments(invoiceId);
  const paymentIds = new Set(applications.map((row) => row.paymentId));
  const voidedPaymentIds = await collectVoidedPaymentIds(invoices, organizationId, paymentIds);
  return computeRemainingCents(invoice, applications, voidedPaymentIds, adjustments);
}
