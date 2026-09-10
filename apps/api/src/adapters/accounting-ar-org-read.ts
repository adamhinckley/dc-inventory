import type { CustomerArLoadedData } from "@dc-inventory/accounting";
import type { IArOrgReadPort } from "@dc-inventory/accounting";
import {
  invoiceAdjustments,
  invoices,
  paymentApplications,
  paymentPlans,
  payments,
} from "@dc-inventory/accounting/schema";
import { CustomerId, InvoiceId } from "@dc-inventory/shared-kernel";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AccountingDrizzle } from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";
import {
  dedupeApplications,
  groupBy,
  toAdjustment,
  toInvoice,
  toPayment,
  toPaymentPlan,
} from "./accounting-ar-read-mappers.js";

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

    const applications = dedupeApplications(invoiceApplicationRows, paymentApplicationRows);
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
      const invoiceApplications = new Map(
        customerInvoices.map((invoice) => [
          invoice.id,
          applicationsByInvoiceId.get(String(invoice.id)) ?? [],
        ]),
      );
      const paymentApplicationsByPayment = new Map(
        customerPayments.map((payment) => [
          payment.id,
          applicationsByPaymentId.get(String(payment.id)) ?? [],
        ]),
      );
      const invoiceAdjustmentsByInvoice = new Map<
        InvoiceId,
        readonly ReturnType<typeof toAdjustment>[]
      >(
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
