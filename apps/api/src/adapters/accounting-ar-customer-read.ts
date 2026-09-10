import type {
  AccountingDrizzle,
  CustomerArLoadedData,
  IArCustomerReadPort,
} from "@dc-inventory/accounting";
import {
  invoiceAdjustments,
  invoices,
  paymentApplications,
  paymentPlans,
  payments,
} from "@dc-inventory/accounting/schema";
import type { CustomerId, InvoiceId, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import {
  dedupeApplications,
  groupBy,
  toAdjustment,
  toInvoice,
  toPayment,
  toPaymentPlan,
} from "./accounting-ar-read-mappers.js";

export class DrizzleArCustomerReadPort implements IArCustomerReadPort {
  constructor(private readonly db: AccountingDrizzle) {}

  async loadCustomerData(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArLoadedData> {
    const customerScope = and(
      eq(invoices.organizationId, organizationId),
      eq(invoices.customerId, customerId),
    );
    const paymentScope = and(
      eq(payments.organizationId, organizationId),
      eq(payments.customerId, customerId),
    );
    const planScope = and(
      eq(paymentPlans.organizationId, organizationId),
      eq(paymentPlans.customerId, customerId),
      isNull(paymentPlans.endedAt),
    );

    const [invoiceRows, paymentRows, planRows] = await Promise.all([
      this.db.select().from(invoices).where(customerScope),
      this.db.select().from(payments).where(paymentScope),
      this.db.select().from(paymentPlans).where(planScope),
    ]);

    const parsedInvoices = invoiceRows.map(toInvoice);
    const parsedPayments = paymentRows.map(toPayment);
    const invoiceIds = parsedInvoices.map((invoice) => invoice.id);
    const paymentIds = parsedPayments.map((payment) => payment.id);

    const [adjustmentRows, invoiceApplicationRows, paymentApplicationRows] = await Promise.all([
      invoiceIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select()
            .from(invoiceAdjustments)
            .where(
              and(
                eq(invoiceAdjustments.organizationId, organizationId),
                inArray(invoiceAdjustments.invoiceId, invoiceIds),
              ),
            ),
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

    const applications = dedupeApplications(invoiceApplicationRows, paymentApplicationRows);
    const applicationsByInvoiceId = groupBy(applications, (row) => String(row.invoiceId));
    const applicationsByPaymentId = groupBy(applications, (row) => String(row.paymentId));
    const adjustmentsByInvoiceId = groupBy(adjustmentRows.map(toAdjustment), (row) =>
      String(row.invoiceId),
    );

    const invoiceApplications = new Map(
      parsedInvoices.map((invoice) => [
        invoice.id,
        applicationsByInvoiceId.get(String(invoice.id)) ?? [],
      ]),
    );
    const paymentApplicationsByPayment = new Map(
      parsedPayments.map((payment) => [
        payment.id,
        applicationsByPaymentId.get(String(payment.id)) ?? [],
      ]),
    );
    const invoiceAdjustmentsByInvoice = new Map<InvoiceId, readonly ReturnType<typeof toAdjustment>[]>(
      parsedInvoices.map((invoice) => [
        invoice.id,
        adjustmentsByInvoiceId.get(String(invoice.id)) ?? [],
      ]),
    );

    return {
      invoices: parsedInvoices,
      applicationsByInvoiceId: invoiceApplications,
      adjustmentsByInvoiceId: invoiceAdjustmentsByInvoice,
      payments: parsedPayments,
      applicationsByPaymentId: paymentApplicationsByPayment,
      activePlan: planRows[0] ? toPaymentPlan(planRows[0]) : null,
    };
  }
}

export function createArCustomerReadPort(db: AppDrizzle): IArCustomerReadPort {
  return new DrizzleArCustomerReadPort(db as unknown as AccountingDrizzle);
}
