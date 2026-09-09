import type { CustomerArLoadedData } from "@dc-inventory/accounting";
import type { IArOrgReadPort } from "@dc-inventory/accounting";
import {
  invoiceAdjustments,
  invoices,
  paymentApplications,
  paymentPlans,
  payments,
} from "@dc-inventory/accounting/schema";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  InvoiceAdjustmentId,
  PaymentApplicationId,
  PaymentId,
  PaymentPlanId,
} from "@dc-inventory/accounting";
import type {
  Invoice,
  InvoiceAdjustment,
  Payment,
  PaymentApplication,
  PaymentPlan,
} from "@dc-inventory/accounting";
import type { AccountingDrizzle } from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";

function toInvoice(row: typeof invoices.$inferSelect): Invoice {
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

function toPayment(row: typeof payments.$inferSelect): Payment {
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

function toApplication(row: typeof paymentApplications.$inferSelect): PaymentApplication {
  return {
    id: PaymentApplicationId.parse(row.id),
    paymentId: PaymentId.parse(row.paymentId),
    invoiceId: InvoiceId.parse(row.invoiceId),
    amount: Money.fromMinorUnits(row.amountCents, row.currency),
    createdAt: row.createdAt,
  };
}

function toAdjustment(row: typeof invoiceAdjustments.$inferSelect): InvoiceAdjustment {
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

function toPaymentPlan(row: typeof paymentPlans.$inferSelect): PaymentPlan {
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

function groupBy<T, K extends string>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = key(row);
    const existing = grouped.get(bucket) ?? [];
    existing.push(row);
    grouped.set(bucket, existing);
  }
  return grouped;
}

export class DrizzleArOrgReadPort implements IArOrgReadPort {
  constructor(private readonly db: AccountingDrizzle) {}

  async loadAllCustomerData(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, CustomerArLoadedData>> {
    const [invoiceRows, paymentRows, adjustmentRows, planRows] = await Promise.all([
      this.db.select().from(invoices).where(eq(invoices.organizationId, organizationId)),
      this.db.select().from(payments).where(eq(payments.organizationId, organizationId)),
      this.db
        .select()
        .from(invoiceAdjustments)
        .where(eq(invoiceAdjustments.organizationId, organizationId)),
      this.db
        .select()
        .from(paymentPlans)
        .where(
          and(eq(paymentPlans.organizationId, organizationId), isNull(paymentPlans.endedAt)),
        ),
    ]);

    const parsedInvoices = invoiceRows.map(toInvoice);
    const parsedPayments = paymentRows.map(toPayment);
    const invoiceIds = parsedInvoices.map((invoice) => invoice.id);
    const paymentIds = parsedPayments.map((payment) => payment.id);

    const [invoiceApplicationRows, paymentApplicationRows] = await Promise.all([
      invoiceIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select()
            .from(paymentApplications)
            .where(inArray(paymentApplications.invoiceId, invoiceIds)),
      paymentIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select()
            .from(paymentApplications)
            .where(inArray(paymentApplications.paymentId, paymentIds)),
    ]);

    const allApplicationRows = [...invoiceApplicationRows, ...paymentApplicationRows];
    const uniqueApplications = new Map(
      allApplicationRows.map((row) => [row.id, toApplication(row)]),
    );
    const applications = [...uniqueApplications.values()];
    const applicationsByInvoiceId = groupBy(applications, (row) => String(row.invoiceId));
    const applicationsByPaymentId = groupBy(applications, (row) => String(row.paymentId));
    const adjustmentsByInvoiceId = groupBy(adjustmentRows.map(toAdjustment), (row) =>
      String(row.invoiceId),
    );
    const invoicesByCustomerId = groupBy(parsedInvoices, (row) => String(row.customerId));
    const paymentsByCustomerId = groupBy(parsedPayments, (row) => String(row.customerId));
    const activePlanByCustomerId = new Map(
      planRows.map((row) => [String(row.customerId), toPaymentPlan(row)]),
    );

    const customerIds = new Set<CustomerId>([
      ...parsedInvoices.map((invoice) => invoice.customerId),
      ...parsedPayments.map((payment) => payment.customerId),
    ]);

    const customerData = new Map<CustomerId, CustomerArLoadedData>();
    for (const customerId of customerIds) {
      const customerKey = String(customerId);
      const customerInvoices = invoicesByCustomerId.get(customerKey) ?? [];
      const customerPayments = paymentsByCustomerId.get(customerKey) ?? [];
      const invoiceApplications = new Map<InvoiceId, readonly PaymentApplication[]>(
        customerInvoices.map((invoice) => [
          invoice.id,
          applicationsByInvoiceId.get(String(invoice.id)) ?? [],
        ]),
      );
      const paymentApplicationsByPayment = new Map<PaymentId, readonly PaymentApplication[]>(
        customerPayments.map((payment) => [
          payment.id,
          applicationsByPaymentId.get(String(payment.id)) ?? [],
        ]),
      );
      const invoiceAdjustmentsByInvoice = new Map<InvoiceId, readonly InvoiceAdjustment[]>(
        customerInvoices.map((invoice) => [
          invoice.id,
          adjustmentsByInvoiceId.get(String(invoice.id)) ?? [],
        ]),
      );

      customerData.set(customerId, {
        invoices: customerInvoices,
        applicationsByInvoiceId: invoiceApplications,
        adjustmentsByInvoiceId: invoiceAdjustmentsByInvoice,
        payments: customerPayments,
        applicationsByPaymentId: paymentApplicationsByPayment,
        activePlan: activePlanByCustomerId.get(customerKey) ?? null,
      });
    }

    return customerData;
  }
}

export function createArOrgReadPort(db: AppDrizzle): IArOrgReadPort {
  return new DrizzleArOrgReadPort(db as unknown as AccountingDrizzle);
}
