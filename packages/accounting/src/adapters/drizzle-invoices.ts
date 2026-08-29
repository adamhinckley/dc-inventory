import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { newUuid, PaymentApplicationId, PaymentId } from "../domain/ids.js";
import type {
  IInvoiceRepository,
  PaymentIdempotencyRecord,
  UnnumberedInvoice,
} from "../domain/ports/invoice-repository.js";
import type { Invoice, Payment, PaymentApplication } from "../domain/invoice.js";
import {
  documentNumberCounters,
  invoices,
  paymentApplications,
  payments,
} from "../persistence/schema.js";

export type AccountingDrizzle = PostgresJsDatabase;

function toInvoice(row: typeof invoices.$inferSelect): Invoice {
  return {
    id: InvoiceId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
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
    createdAt: row.createdAt,
  };
}

async function allocateDocumentNumber(
  db: AccountingDrizzle,
  organizationId: OrganizationId,
): Promise<string> {
  const rows = await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: 1 })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: { lastValue: sql`${documentNumberCounters.lastValue} + 1` },
    })
    .returning({ sequence: documentNumberCounters.lastValue });
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error("Failed to allocate invoice document number");
  }
  return formatDocumentNumber(sequence);
}

async function advanceCounter(
  db: AccountingDrizzle,
  organizationId: OrganizationId,
  documentNumber: string,
): Promise<void> {
  const sequence = parseDocumentSequence(documentNumber);
  if (sequence === null) {
    return;
  }
  await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: sequence })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: {
        lastValue: sql`greatest(${documentNumberCounters.lastValue}, ${sequence})`,
      },
    });
}

async function insertInvoice(db: AccountingDrizzle, invoice: Invoice): Promise<void> {
  await db.insert(invoices).values({
    id: invoice.id,
    organizationId: invoice.organizationId,
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

export class DrizzleInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly db: AccountingDrizzle) {}

  async findById(organizationId: OrganizationId, id: InvoiceId): Promise<Invoice | null> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toInvoice(row);
  }

  async findByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<Invoice | null> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orderId, orderId), eq(invoices.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toInvoice(row);
  }

  async list(organizationId: OrganizationId): Promise<readonly Invoice[]> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId));
    return rows.map(toInvoice);
  }

  async save(invoice: Invoice): Promise<void> {
    await this.db.transaction(async (tx) => {
      const transactionalDb = tx as AccountingDrizzle;
      const repo = new DrizzleInvoiceRepository(transactionalDb);
      const existing = await repo.findById(invoice.organizationId, invoice.id);
      if (existing !== null) {
        return;
      }
      await advanceCounter(
        transactionalDb,
        invoice.organizationId,
        invoice.documentNumber,
      );
      await insertInvoice(transactionalDb, invoice);
    });
  }

  async insertWithNextDocumentNumber(
    invoice: UnnumberedInvoice,
  ): Promise<Invoice> {
    return this.db.transaction(async (tx) => {
      const transactionalDb = tx as AccountingDrizzle;
      const documentNumber = await allocateDocumentNumber(
        transactionalDb,
        invoice.organizationId,
      );
      const numbered = { ...invoice, documentNumber };
      await insertInvoice(transactionalDb, numbered);
      return numbered;
    });
  }

  async listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]> {
    const rows = await this.db
      .select()
      .from(paymentApplications)
      .where(eq(paymentApplications.invoiceId, invoiceId));
    return rows.map(toApplication);
  }

  async findPaymentByIdempotencyKey(
    organizationId: OrganizationId,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null> {
    const paymentRows = await this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.organizationId, organizationId), eq(payments.idempotencyKey, key)),
      )
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
      organizationId: OrganizationId.parse(paymentRow.organizationId),
      customerId: CustomerId.parse(paymentRow.customerId),
      amount: Money.fromMinorUnits(paymentRow.amountCents, paymentRow.currency),
      idempotencyKey: paymentRow.idempotencyKey,
      createdAt: paymentRow.createdAt,
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
      organizationId: payment.organizationId,
      customerId: payment.customerId,
      amountCents: payment.amount.amountMinor,
      currency: payment.amount.currency,
      idempotencyKey: payment.idempotencyKey,
      createdAt: payment.createdAt,
    });
    await this.db.insert(paymentApplications).values({
      id: PaymentApplicationId.parse(newUuid()),
      paymentId: payment.id,
      invoiceId,
      amountCents: applicationAmountCents,
      currency: payment.amount.currency,
      createdAt: payment.createdAt,
    });
  }

  async insertApplication(application: PaymentApplication): Promise<void> {
    await this.db.insert(paymentApplications).values({
      id: application.id,
      paymentId: application.paymentId,
      invoiceId: application.invoiceId,
      amountCents: application.amount.amountMinor,
      currency: application.amount.currency,
      createdAt: application.createdAt,
    });
  }
}
