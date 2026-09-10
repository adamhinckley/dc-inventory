import type { InvoiceId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { PaymentId } from "../domain/ids.js";
import { computeRemainingCents } from "../domain/invoice.js";
import type { Invoice, Payment, PaymentMethod } from "../domain/invoice.js";
import type { PaymentIdempotencyRecord, PaymentApplicationSpec } from "../domain/ports/invoice-repository.js";

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

export type InvoicePaymentReadPort = {
  findPaymentById(organizationId: OrganizationId, paymentId: PaymentId): Promise<Payment | null>;
  findPaymentsByIds(
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ): Promise<ReadonlyMap<PaymentId, Payment>>;
  findByIdForPayment(organizationId: OrganizationId, id: InvoiceId): Promise<import("../domain/invoice.js").Invoice | null>;
  findByIdsForPayment(
    organizationId: OrganizationId,
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, import("../domain/invoice.js").Invoice>>;
  listApplications(invoiceId: InvoiceId): Promise<readonly import("../domain/invoice.js").PaymentApplication[]>;
  listApplicationsByInvoiceIds(
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, readonly import("../domain/invoice.js").PaymentApplication[]>>;
  listAdjustments(
    invoiceId: InvoiceId,
  ): Promise<readonly import("../domain/invoice.js").InvoiceAdjustment[]>;
  listAdjustmentsByInvoiceIds(
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, readonly import("../domain/invoice.js").InvoiceAdjustment[]>>;
};

function uniqueInvoiceIds(invoiceIds: readonly InvoiceId[]): InvoiceId[] {
  return [...new Set(invoiceIds)];
}

function uniquePaymentIds(paymentIds: Iterable<PaymentId>): PaymentId[] {
  return [...new Set(paymentIds)];
}

export async function collectVoidedPaymentIds(
  invoices: Pick<InvoicePaymentReadPort, "findPaymentById" | "findPaymentsByIds">,
  organizationId: OrganizationId,
  paymentIds: Iterable<PaymentId>,
): Promise<Set<PaymentId>> {
  const ids = uniquePaymentIds(paymentIds);
  if (ids.length === 0) {
    return new Set();
  }
  const payments = await invoices.findPaymentsByIds(organizationId, ids);
  const voided = new Set<PaymentId>();
  for (const paymentId of ids) {
    const payment = payments.get(paymentId);
    if (payment !== undefined && payment.voidedAt != null) {
      voided.add(paymentId);
    }
  }
  return voided;
}

export async function remainingForInvoices(
  invoices: InvoicePaymentReadPort,
  organizationId: OrganizationId,
  invoiceIds: readonly InvoiceId[],
  preloadedInvoices?: ReadonlyMap<InvoiceId, Invoice>,
): Promise<ReadonlyMap<InvoiceId, number | null>> {
  const uniqueIds = uniqueInvoiceIds(invoiceIds);
  const remainingByInvoiceId = new Map<InvoiceId, number | null>();
  if (uniqueIds.length === 0) {
    return remainingByInvoiceId;
  }

  const invoiceMap =
    preloadedInvoices ??
    await invoices.findByIdsForPayment(organizationId, uniqueIds);
  const [applicationsMap, adjustmentsMap] = await Promise.all([
    invoices.listApplicationsByInvoiceIds(uniqueIds),
    invoices.listAdjustmentsByInvoiceIds(uniqueIds),
  ]);
  const paymentIds = new Set<PaymentId>();
  for (const applications of applicationsMap.values()) {
    for (const application of applications) {
      paymentIds.add(application.paymentId);
    }
  }
  const voidedPaymentIds = await collectVoidedPaymentIds(invoices, organizationId, paymentIds);

  for (const invoiceId of uniqueIds) {
    const invoice = invoiceMap.get(invoiceId);
    if (invoice === undefined) {
      remainingByInvoiceId.set(invoiceId, null);
      continue;
    }
    remainingByInvoiceId.set(
      invoiceId,
      computeRemainingCents(
        invoice,
        applicationsMap.get(invoiceId) ?? [],
        voidedPaymentIds,
        adjustmentsMap.get(invoiceId) ?? [],
      ),
    );
  }
  return remainingByInvoiceId;
}
