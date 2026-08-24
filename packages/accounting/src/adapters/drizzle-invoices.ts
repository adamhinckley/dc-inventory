import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
} from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { newUuid, PaymentApplicationId, PaymentId } from "../domain/ids.js";
import type {
  IInvoiceRepository,
  PaymentIdempotencyRecord,
} from "../domain/ports/invoice-repository.js";
import type { Invoice, Payment, PaymentApplication } from "../domain/invoice.js";
import {
  invoices,
  paymentApplications,
  payments,
} from "../persistence/schema.js";

export type AccountingDrizzle = PostgresJsDatabase<{
  invoices: typeof invoices;
  payments: typeof payments;
  paymentApplications: typeof paymentApplications;
}>;

function toInvoice(row: typeof invoices.$inferSelect): Invoice {
  return {
    id: InvoiceId.parse(row.id),
    orderId: OrderId.parse(row.orderId),
    customerId: CustomerId.parse(row.customerId),
    documentNumber: row.documentNumber,
    status: row.status,
    postedAt: row.postedAt,
    subtotal: Money.fromMinorUnits(row.subtotalCents, row.currency),
    taxTotal: Money.fromMinorUnits(row.taxTotalCents, row.currency),
    total: Money.fromMinorUnits(row.totalCents, row.currency),
  };
}

function toApplication(row: typeof paymentApplications.$inferSelect): PaymentApplication {
  return {
    id: PaymentApplicationId.parse(row.id),
    paymentId: PaymentId.parse(row.paymentId),
    invoiceId: InvoiceId.parse(row.invoiceId),
    amount: Money.fromMinorUnits(row.amountCents, row.currency),
  };
}

export class DrizzleInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly db: AccountingDrizzle) {}

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const rows = await this.db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toInvoice(row);
  }

  async findByOrderId(orderId: OrderId): Promise<Invoice | null> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toInvoice(row);
  }

  async save(invoice: Invoice): Promise<void> {
    const existing = await this.findById(invoice.id);
    if (existing !== null) {
      return;
    }
    await this.db.insert(invoices).values({
      id: invoice.id,
      orderId: invoice.orderId,
      customerId: invoice.customerId,
      documentNumber: invoice.documentNumber,
      status: invoice.status,
      postedAt: invoice.postedAt,
      subtotalCents: invoice.subtotal.amountMinor,
      taxTotalCents: invoice.taxTotal.amountMinor,
      totalCents: invoice.total.amountMinor,
      currency: invoice.total.currency,
    });
  }

  async nextDocumentNumber(): Promise<string> {
    const rows = await this.db.select({ documentNumber: invoices.documentNumber }).from(invoices);
    let max = 0;
    for (const row of rows) {
      const sequence = parseDocumentSequence(row.documentNumber);
      if (sequence !== null && sequence > max) {
        max = sequence;
      }
    }
    return formatDocumentNumber(max + 1);
  }

  async listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]> {
    const rows = await this.db
      .select()
      .from(paymentApplications)
      .where(eq(paymentApplications.invoiceId, invoiceId));
    return rows.map(toApplication);
  }

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentIdempotencyRecord | null> {
    const paymentRows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, key))
      .limit(1);
    const paymentRow = paymentRows[0];
    if (paymentRow === undefined) {
      return null;
    }
    const applicationRows = await this.db
      .select()
      .from(paymentApplications)
      .where(eq(paymentApplications.paymentId, paymentRow.id))
      .limit(1);
    const applicationRow = applicationRows[0];
    if (applicationRow === undefined) {
      return null;
    }
    const payment: Payment = {
      id: PaymentId.parse(paymentRow.id),
      customerId: CustomerId.parse(paymentRow.customerId),
      amount: Money.fromMinorUnits(paymentRow.amountCents, paymentRow.currency),
      idempotencyKey: paymentRow.idempotencyKey,
    };
    return {
      payment,
      invoiceId: InvoiceId.parse(applicationRow.invoiceId),
      applicationAmountCents: applicationRow.amountCents,
    };
  }

  async insertPaymentWithApplication(
    payment: Payment,
    invoiceId: InvoiceId,
    applicationAmountCents: number,
  ): Promise<void> {
    await this.db.insert(payments).values({
      id: payment.id,
      customerId: payment.customerId,
      amountCents: payment.amount.amountMinor,
      currency: payment.amount.currency,
      idempotencyKey: payment.idempotencyKey,
    });
    await this.db.insert(paymentApplications).values({
      id: PaymentApplicationId.parse(newUuid()),
      paymentId: payment.id,
      invoiceId,
      amountCents: applicationAmountCents,
      currency: payment.amount.currency,
    });
  }

  async insertApplication(application: PaymentApplication): Promise<void> {
    await this.db.insert(paymentApplications).values({
      id: application.id,
      paymentId: application.paymentId,
      invoiceId: application.invoiceId,
      amountCents: application.amount.amountMinor,
      currency: application.amount.currency,
    });
  }
}
