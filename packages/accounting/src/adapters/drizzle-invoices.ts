import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import {
  InvoiceAdjustmentId,
  newUuid,
  PaymentApplicationId,
  PaymentId,
  PaymentPlanId,
} from "../domain/ids.js";
import type {
  IAccountingRepository,
  PaymentApplicationSpec,
  PaymentIdempotencyRecord,
  UnnumberedInvoice,
} from "../domain/ports/invoice-repository.js";
import type {
  Invoice,
  InvoiceAdjustment,
  Payment,
  PaymentApplication,
  PaymentPlan,
} from "../domain/invoice.js";
import {
  documentNumberCounters,
  invoiceAdjustments,
  invoices,
  paymentApplications,
  paymentPlans,
  payments,
  type StoredIdempotencyApplication,
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

function toStoredIdempotencyApplications(
  applications: readonly PaymentApplicationSpec[],
): readonly StoredIdempotencyApplication[] {
  return applications.map((row) => ({
    invoiceId: String(row.invoiceId),
    amountCents: row.amountCents,
  }));
}

function fromStoredIdempotencyApplications(
  stored: readonly StoredIdempotencyApplication[],
): readonly PaymentApplicationSpec[] {
  return stored.map((row) => ({
    invoiceId: InvoiceId.parse(row.invoiceId),
    amountCents: row.amountCents,
  }));
}

function paymentInsertValues(
  payment: Payment,
  applications: readonly PaymentApplicationSpec[],
  holdRemainderAsCredit: boolean,
): typeof payments.$inferInsert {
  return {
    id: payment.id,
    organizationId: payment.organizationId,
    customerId: payment.customerId,
    amountCents: payment.amount.amountMinor,
    currency: payment.amount.currency,
    idempotencyKey: payment.idempotencyKey,
    createdAt: payment.createdAt,
    method: payment.method ?? "other",
    reference: payment.reference ?? null,
    receivedAt: payment.receivedAt ?? payment.createdAt,
    note: payment.note ?? null,
    recordedBy: payment.recordedBy ?? null,
    voidedAt: payment.voidedAt ?? null,
    voidedBy: payment.voidedBy ?? null,
    voidReason: payment.voidReason ?? null,
    holdRemainderAsCredit,
    idempotencyApplications: toStoredIdempotencyApplications(applications),
  };
}

function toIdempotencyRecord(
  payment: Payment,
  applications: readonly PaymentApplicationSpec[],
  holdRemainderAsCredit: boolean,
): PaymentIdempotencyRecord {
  const firstApplication = applications[0];
  return {
    payment,
    applications,
    holdRemainderAsCredit,
    ...(firstApplication === undefined
      ? {}
      : {
          invoiceId: firstApplication.invoiceId,
          applicationAmountCents: firstApplication.amountCents,
        }),
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
  if (sequence === null || sequence < 1) {
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
    billLine1: invoice.billLine1,
    billLine2: invoice.billLine2,
    billCity: invoice.billCity,
    billRegion: invoice.billRegion,
    billPostal: invoice.billPostal,
    billCountry: invoice.billCountry,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    subtotalCents: invoice.subtotal.amountMinor,
    totalCents: invoice.total.amountMinor,
    currency: invoice.total.currency,
  });
}

export class DrizzleInvoiceRepository implements IAccountingRepository {
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

  async findByIdForPayment(
    organizationId: OrganizationId,
    id: InvoiceId,
  ): Promise<Invoice | null> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
      .limit(1)
      .for("update");
    const row = rows[0];
    return row === undefined ? null : toInvoice(row);
  }

  async findByIdsForPayment(
    organizationId: OrganizationId,
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, Invoice>> {
    const uniqueIds = [...new Set(invoiceIds)];
    const byId = new Map<InvoiceId, Invoice>();
    if (uniqueIds.length === 0) {
      return byId;
    }
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.organizationId, organizationId), inArray(invoices.id, uniqueIds)),
      )
      .for("update");
    for (const row of rows) {
      const invoice = toInvoice(row);
      byId.set(invoice.id, invoice);
    }
    return byId;
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

  async listApplicationsByInvoiceIds(
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, readonly PaymentApplication[]>> {
    const uniqueIds = [...new Set(invoiceIds)];
    const byInvoiceId = new Map<InvoiceId, PaymentApplication[]>();
    if (uniqueIds.length === 0) {
      return byInvoiceId;
    }
    const rows = await this.db
      .select()
      .from(paymentApplications)
      .where(inArray(paymentApplications.invoiceId, uniqueIds));
    for (const row of rows) {
      const application = toApplication(row);
      const invoiceRows = byInvoiceId.get(application.invoiceId) ?? [];
      invoiceRows.push(application);
      byInvoiceId.set(application.invoiceId, invoiceRows);
    }
    return byInvoiceId;
  }

  async listApplicationsByPayment(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<readonly PaymentApplication[]> {
    const rows = await this.db
      .select({ application: paymentApplications })
      .from(paymentApplications)
      .innerJoin(payments, eq(paymentApplications.paymentId, payments.id))
      .where(
        and(
          eq(paymentApplications.paymentId, paymentId),
          eq(payments.organizationId, organizationId),
        ),
      );
    return rows.map((row) => toApplication(row.application));
  }

  async findPaymentById(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPayment(row);
  }

  async findPaymentsByIds(
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ): Promise<ReadonlyMap<PaymentId, Payment>> {
    const uniqueIds = [...new Set(paymentIds)];
    const byId = new Map<PaymentId, Payment>();
    if (uniqueIds.length === 0) {
      return byId;
    }
    const rows = await this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.organizationId, organizationId), inArray(payments.id, uniqueIds)),
      );
    for (const row of rows) {
      const payment = toPayment(row);
      byId.set(payment.id, payment);
    }
    return byId;
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
    const payment = toPayment(paymentRow);
    const applications = fromStoredIdempotencyApplications(paymentRow.idempotencyApplications);
    return toIdempotencyRecord(
      payment,
      applications,
      paymentRow.holdRemainderAsCredit,
    );
  }

  async insertPaymentWithApplication(
    payment: Payment,
    invoiceId: InvoiceId,
    applicationAmountCents: number,
  ): Promise<void> {
    await this.insertPaymentWithApplications(
      payment,
      [{ invoiceId, amountCents: applicationAmountCents }],
      false,
    );
  }

  async insertPaymentWithApplications(
    payment: Payment,
    applications: readonly PaymentApplicationSpec[],
    holdRemainderAsCredit: boolean,
  ): Promise<void> {
    await this.db.insert(payments).values(
      paymentInsertValues(payment, applications, holdRemainderAsCredit),
    );
    if (applications.length === 0) {
      return;
    }
    await this.db.insert(paymentApplications).values(
      applications.map((spec) => ({
        id: PaymentApplicationId.parse(newUuid()),
        paymentId: payment.id,
        invoiceId: spec.invoiceId,
        amountCents: spec.amountCents,
        currency: payment.amount.currency,
        createdAt: payment.createdAt,
      })),
    );
  }

  async updatePayment(payment: Payment): Promise<void> {
    await this.db
      .update(payments)
      .set({
        method: payment.method ?? "other",
        reference: payment.reference ?? null,
        receivedAt: payment.receivedAt ?? payment.createdAt,
        note: payment.note ?? null,
        recordedBy: payment.recordedBy ?? null,
        voidedAt: payment.voidedAt ?? null,
        voidedBy: payment.voidedBy ?? null,
        voidReason: payment.voidReason ?? null,
      })
      .where(
        and(eq(payments.id, payment.id), eq(payments.organizationId, payment.organizationId)),
      );
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

  async listAdjustments(invoiceId: InvoiceId): Promise<readonly InvoiceAdjustment[]> {
    const rows = await this.db
      .select({ adjustment: invoiceAdjustments })
      .from(invoiceAdjustments)
      .innerJoin(invoices, eq(invoiceAdjustments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoiceAdjustments.invoiceId, invoiceId),
          eq(invoiceAdjustments.organizationId, invoices.organizationId),
        ),
      );
    return rows.map((row) => toAdjustment(row.adjustment));
  }

  async listAdjustmentsByInvoiceIds(
    invoiceIds: readonly InvoiceId[],
  ): Promise<ReadonlyMap<InvoiceId, readonly InvoiceAdjustment[]>> {
    const uniqueIds = [...new Set(invoiceIds)];
    const byInvoiceId = new Map<InvoiceId, InvoiceAdjustment[]>();
    if (uniqueIds.length === 0) {
      return byInvoiceId;
    }
    const rows = await this.db
      .select({ adjustment: invoiceAdjustments })
      .from(invoiceAdjustments)
      .innerJoin(invoices, eq(invoiceAdjustments.invoiceId, invoices.id))
      .where(
        and(
          inArray(invoiceAdjustments.invoiceId, uniqueIds),
          eq(invoiceAdjustments.organizationId, invoices.organizationId),
        ),
      );
    for (const row of rows) {
      const adjustment = toAdjustment(row.adjustment);
      const invoiceRows = byInvoiceId.get(adjustment.invoiceId) ?? [];
      invoiceRows.push(adjustment);
      byInvoiceId.set(adjustment.invoiceId, invoiceRows);
    }
    return byInvoiceId;
  }

  async insertAdjustment(adjustment: InvoiceAdjustment): Promise<void> {
    await this.db.insert(invoiceAdjustments).values({
      id: adjustment.id,
      organizationId: adjustment.organizationId,
      invoiceId: adjustment.invoiceId,
      kind: adjustment.kind,
      amountCents: adjustment.amountCents,
      currency: adjustment.currency,
      reason: adjustment.reason,
      recordedBy: adjustment.createdBy,
      createdAt: adjustment.createdAt,
    });
  }

  async findActivePaymentPlan(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<PaymentPlan | null> {
    const rows = await this.db
      .select()
      .from(paymentPlans)
      .where(
        and(
          eq(paymentPlans.organizationId, organizationId),
          eq(paymentPlans.customerId, customerId),
          sql`${paymentPlans.endedAt} is null`,
        ),
      )
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPaymentPlan(row);
  }

  async findPaymentPlanById(
    organizationId: OrganizationId,
    planId: PaymentPlanId,
  ): Promise<PaymentPlan | null> {
    const rows = await this.db
      .select()
      .from(paymentPlans)
      .where(and(eq(paymentPlans.id, planId), eq(paymentPlans.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPaymentPlan(row);
  }

  async insertPaymentPlan(plan: PaymentPlan): Promise<void> {
    await this.db.insert(paymentPlans).values({
      id: plan.id,
      organizationId: plan.organizationId,
      customerId: plan.customerId,
      amountCents: plan.installmentAmountCents,
      currency: plan.currency,
      frequency: plan.frequency,
      startsOn: plan.startsOn,
      endedAt: plan.endedAt,
      createdBy: plan.createdBy,
      createdAt: plan.createdAt,
    });
  }

  async endPaymentPlan(planId: PaymentPlanId, endedAt: Date): Promise<void> {
    const rows = await this.db
      .select({ organizationId: paymentPlans.organizationId })
      .from(paymentPlans)
      .where(eq(paymentPlans.id, planId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new Error(`Payment plan ${planId} not found`);
    }
    await this.db
      .update(paymentPlans)
      .set({ endedAt })
      .where(
        and(
          eq(paymentPlans.id, planId),
          eq(paymentPlans.organizationId, row.organizationId),
        ),
      );
  }

  async listPaymentsByCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<readonly Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.organizationId, organizationId), eq(payments.customerId, customerId)),
      );
    return rows.map(toPayment);
  }
}
