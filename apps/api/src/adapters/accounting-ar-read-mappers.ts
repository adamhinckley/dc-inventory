import {
  InvoiceAdjustmentId,
  PaymentApplicationId,
  PaymentId,
  PaymentPlanId,
  type Invoice,
  type InvoiceAdjustment,
  type Payment,
  type PaymentApplication,
  type PaymentPlan,
} from "@dc-inventory/accounting";
import {
  invoiceAdjustments,
  paymentApplications,
  paymentPlans,
  payments,
  invoices,
} from "@dc-inventory/accounting/schema";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";

export function toInvoice(row: typeof invoices.$inferSelect): Invoice {
  return {
    id: InvoiceId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    orderId: OrderId.parse(row.orderId),
    customerId: CustomerId.parse(row.customerId),
    documentNumber: row.documentNumber,
    status: row.status,
    postedAt: row.postedAt,
    billLine1: row.billLine1,
    billLine2: row.billLine2,
    billCity: row.billCity,
    billRegion: row.billRegion,
    billPostal: row.billPostal,
    billCountry: row.billCountry,
    dueDate: row.dueDate,
    terms: row.terms,
    subtotal: Money.fromMinorUnits(row.subtotalCents, row.currency),
    taxTotal: Money.fromMinorUnits(0, row.currency),
    total: Money.fromMinorUnits(row.totalCents, row.currency),
  };
}

export function toPayment(row: typeof payments.$inferSelect): Payment {
  return {
    id: PaymentId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    customerId: CustomerId.parse(row.customerId),
    amount: Money.fromMinorUnits(row.amountCents, row.currency),
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    method: row.method,
    reference: row.reference,
    receivedAt: row.receivedAt,
    note: row.note,
    recordedBy: row.recordedBy ? StaffUserId.parse(row.recordedBy) : undefined,
    voidedAt: row.voidedAt,
    voidedBy: row.voidedBy ? StaffUserId.parse(row.voidedBy) : null,
    voidReason: row.voidReason,
  };
}

export function toApplication(row: typeof paymentApplications.$inferSelect): PaymentApplication {
  return {
    id: PaymentApplicationId.parse(row.id),
    paymentId: PaymentId.parse(row.paymentId),
    invoiceId: InvoiceId.parse(row.invoiceId),
    amount: Money.fromMinorUnits(row.amountCents, row.currency),
    createdAt: row.createdAt,
  };
}

export function toAdjustment(row: typeof invoiceAdjustments.$inferSelect): InvoiceAdjustment {
  return {
    id: InvoiceAdjustmentId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    invoiceId: InvoiceId.parse(row.invoiceId),
    kind: row.kind,
    amountCents: row.amountCents,
    currency: row.currency,
    reason: row.reason,
    createdAt: row.createdAt,
    createdBy: StaffUserId.parse(row.recordedBy),
  };
}

export function toPaymentPlan(row: typeof paymentPlans.$inferSelect): PaymentPlan {
  return {
    id: PaymentPlanId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    customerId: CustomerId.parse(row.customerId),
    frequency: row.frequency,
    installmentAmountCents: row.amountCents,
    currency: row.currency,
    startsOn: row.startsOn,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    createdBy: StaffUserId.parse(row.createdBy),
  };
}

export function groupBy<T, K extends string>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = key(row);
    const existing = grouped.get(bucket) ?? [];
    existing.push(row);
    grouped.set(bucket, existing);
  }
  return grouped;
}

export function dedupeApplications(
  invoiceApplicationRows: readonly (typeof paymentApplications.$inferSelect)[],
  paymentApplicationRows: readonly (typeof paymentApplications.$inferSelect)[],
): PaymentApplication[] {
  const allApplicationRows = [...invoiceApplicationRows, ...paymentApplicationRows];
  const uniqueApplications = new Map(
    allApplicationRows.map((row) => [row.id, toApplication(row)]),
  );
  return [...uniqueApplications.values()];
}
