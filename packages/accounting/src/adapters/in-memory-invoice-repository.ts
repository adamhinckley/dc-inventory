import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
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

type StoredInvoice = { invoice: Invoice; createdAt: Date };

function paymentKey(organizationId: OrganizationId, key: string): string {
  return `${organizationId}\0${key}`;
}

function toInvoice(invoice: Invoice): Invoice {
  return {
    id: InvoiceId.parse(invoice.id),
    organizationId: OrganizationId.parse(invoice.organizationId),
    orderId: OrderId.parse(invoice.orderId),
    customerId: CustomerId.parse(invoice.customerId),
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
    subtotal: Money.fromMinorUnits(
      invoice.subtotal.amountMinor,
      invoice.subtotal.currency,
    ),
    taxTotal: Money.fromMinorUnits(
      invoice.taxTotal.amountMinor,
      invoice.taxTotal.currency,
    ),
    total: Money.fromMinorUnits(invoice.total.amountMinor, invoice.total.currency),
  };
}

function toPayment(payment: Payment): Payment {
  return {
    id: PaymentId.parse(payment.id),
    organizationId: OrganizationId.parse(payment.organizationId),
    customerId: CustomerId.parse(payment.customerId),
    amount: Money.fromMinorUnits(payment.amount.amountMinor, payment.amount.currency),
    idempotencyKey: payment.idempotencyKey,
    createdAt: new Date(payment.createdAt.getTime()),
    method: payment.method,
    reference: payment.reference ?? null,
    receivedAt: payment.receivedAt ? new Date(payment.receivedAt.getTime()) : undefined,
    note: payment.note ?? null,
    recordedBy: payment.recordedBy,
    voidedAt: payment.voidedAt ? new Date(payment.voidedAt.getTime()) : null,
    voidedBy: payment.voidedBy ?? null,
    voidReason: payment.voidReason ?? null,
  };
}

export class InMemoryInvoiceRepository implements IAccountingRepository {
  private readonly byId = new Map<InvoiceId, StoredInvoice>();
  private readonly byOrderId = new Map<OrderId, InvoiceId>();
  private readonly applicationsByInvoice = new Map<InvoiceId, PaymentApplication[]>();
  private readonly applicationsByPayment = new Map<PaymentId, PaymentApplication[]>();
  private readonly paymentsById = new Map<PaymentId, Payment>();
  private readonly paymentsByKey = new Map<string, PaymentIdempotencyRecord>();
  private readonly adjustmentsByInvoice = new Map<InvoiceId, InvoiceAdjustment[]>();
  private readonly paymentPlans = new Map<PaymentPlanId, PaymentPlan>();
  private readonly nextSequenceByOrg = new Map<string, number>();

  snapshot(): {
    byId: Map<InvoiceId, StoredInvoice>;
    byOrderId: Map<OrderId, InvoiceId>;
    applicationsByInvoice: Map<InvoiceId, PaymentApplication[]>;
    applicationsByPayment: Map<PaymentId, PaymentApplication[]>;
    paymentsById: Map<PaymentId, Payment>;
    paymentsByKey: Map<string, PaymentIdempotencyRecord>;
    adjustmentsByInvoice: Map<InvoiceId, InvoiceAdjustment[]>;
    paymentPlans: Map<PaymentPlanId, PaymentPlan>;
    nextSequenceByOrg: Map<string, number>;
  } {
    const applicationsByInvoice = new Map<InvoiceId, PaymentApplication[]>();
    for (const [id, rows] of this.applicationsByInvoice) {
      applicationsByInvoice.set(id, [...rows]);
    }
    const applicationsByPayment = new Map<PaymentId, PaymentApplication[]>();
    for (const [id, rows] of this.applicationsByPayment) {
      applicationsByPayment.set(id, [...rows]);
    }
    const adjustmentsByInvoice = new Map<InvoiceId, InvoiceAdjustment[]>();
    for (const [id, rows] of this.adjustmentsByInvoice) {
      adjustmentsByInvoice.set(id, [...rows]);
    }
    return {
      byId: new Map(this.byId),
      byOrderId: new Map(this.byOrderId),
      applicationsByInvoice,
      applicationsByPayment,
      paymentsById: new Map(this.paymentsById),
      paymentsByKey: new Map(this.paymentsByKey),
      adjustmentsByInvoice,
      paymentPlans: new Map(this.paymentPlans),
      nextSequenceByOrg: new Map(this.nextSequenceByOrg),
    };
  }

  restore(snapshot: {
    byId: Map<InvoiceId, StoredInvoice>;
    byOrderId: Map<OrderId, InvoiceId>;
    applicationsByInvoice: Map<InvoiceId, PaymentApplication[]>;
    applicationsByPayment: Map<PaymentId, PaymentApplication[]>;
    paymentsById: Map<PaymentId, Payment>;
    paymentsByKey: Map<string, PaymentIdempotencyRecord>;
    adjustmentsByInvoice: Map<InvoiceId, InvoiceAdjustment[]>;
    paymentPlans: Map<PaymentPlanId, PaymentPlan>;
    nextSequenceByOrg: Map<string, number>;
  }): void {
    this.byId.clear();
    for (const [id, row] of snapshot.byId) {
      this.byId.set(id, row);
    }
    this.byOrderId.clear();
    for (const [orderId, invoiceId] of snapshot.byOrderId) {
      this.byOrderId.set(orderId, invoiceId);
    }
    this.applicationsByInvoice.clear();
    for (const [id, rows] of snapshot.applicationsByInvoice) {
      this.applicationsByInvoice.set(id, [...rows]);
    }
    this.applicationsByPayment.clear();
    for (const [id, rows] of snapshot.applicationsByPayment) {
      this.applicationsByPayment.set(id, [...rows]);
    }
    this.paymentsById.clear();
    for (const [id, payment] of snapshot.paymentsById) {
      this.paymentsById.set(id, payment);
    }
    this.paymentsByKey.clear();
    for (const [key, record] of snapshot.paymentsByKey) {
      this.paymentsByKey.set(key, record);
    }
    this.adjustmentsByInvoice.clear();
    for (const [id, rows] of snapshot.adjustmentsByInvoice) {
      this.adjustmentsByInvoice.set(id, [...rows]);
    }
    this.paymentPlans.clear();
    for (const [id, plan] of snapshot.paymentPlans) {
      this.paymentPlans.set(id, plan);
    }
    this.nextSequenceByOrg.clear();
    for (const [orgKey, sequence] of snapshot.nextSequenceByOrg) {
      this.nextSequenceByOrg.set(orgKey, sequence);
    }
  }

  async findById(organizationId: OrganizationId, id: InvoiceId): Promise<Invoice | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.invoice.organizationId !== organizationId) {
      return null;
    }
    return row.invoice;
  }

  findByIdForPayment(
    organizationId: OrganizationId,
    id: InvoiceId,
  ): Promise<Invoice | null> {
    return this.findById(organizationId, id);
  }

  async findByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<Invoice | null> {
    const id = this.byOrderId.get(orderId);
    if (id === undefined) {
      return null;
    }
    return this.findById(organizationId, id);
  }

  async list(organizationId: OrganizationId): Promise<readonly Invoice[]> {
    return [...this.byId.values()]
      .filter((row) => row.invoice.organizationId === organizationId)
      .map((row) => row.invoice);
  }

  async save(invoice: Invoice): Promise<void> {
    const normalized = toInvoice(invoice);
    const existing = this.byId.get(normalized.id);
    this.byId.set(normalized.id, {
      invoice: normalized,
      createdAt: existing?.createdAt ?? new Date(),
    });
    this.byOrderId.set(normalized.orderId, normalized.id);
    const sequence = parseDocumentSequence(normalized.documentNumber);
    if (sequence !== null) {
      const orgKey = normalized.organizationId;
      const current = this.nextSequenceByOrg.get(orgKey) ?? 1;
      if (sequence >= current) {
        this.nextSequenceByOrg.set(orgKey, sequence + 1);
      }
    }
  }

  async insertWithNextDocumentNumber(invoice: UnnumberedInvoice): Promise<Invoice> {
    const orgKey = invoice.organizationId;
    const next = this.nextSequenceByOrg.get(orgKey) ?? 1;
    const numbered = { ...invoice, documentNumber: formatDocumentNumber(next) };
    await this.save(numbered);
    return toInvoice(numbered);
  }

  async listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]> {
    return [...(this.applicationsByInvoice.get(invoiceId) ?? [])];
  }

  async listApplicationsByPayment(paymentId: PaymentId): Promise<readonly PaymentApplication[]> {
    return [...(this.applicationsByPayment.get(paymentId) ?? [])];
  }

  async findPaymentById(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<Payment | null> {
    const payment = this.paymentsById.get(paymentId);
    if (payment === undefined || payment.organizationId !== organizationId) {
      return null;
    }
    return payment;
  }

  async findPaymentByIdempotencyKey(
    organizationId: OrganizationId,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null> {
    return this.paymentsByKey.get(paymentKey(organizationId, key)) ?? null;
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
    const normalized = toPayment(payment);
    this.paymentsById.set(normalized.id, normalized);
    for (const spec of applications) {
      const application: PaymentApplication = {
        id: PaymentApplicationId.parse(newUuid()),
        paymentId: normalized.id,
        invoiceId: InvoiceId.parse(spec.invoiceId),
        amount: Money.fromMinorUnits(spec.amountCents, normalized.amount.currency),
        createdAt: new Date(normalized.createdAt.getTime()),
      };
      const invoiceRows = this.applicationsByInvoice.get(application.invoiceId) ?? [];
      invoiceRows.push(application);
      this.applicationsByInvoice.set(application.invoiceId, invoiceRows);
      const paymentRows = this.applicationsByPayment.get(normalized.id) ?? [];
      paymentRows.push(application);
      this.applicationsByPayment.set(normalized.id, paymentRows);
    }
    this.paymentsByKey.set(paymentKey(normalized.organizationId, normalized.idempotencyKey), {
      payment: normalized,
      applications: applications.map((row) => ({
        invoiceId: InvoiceId.parse(row.invoiceId),
        amountCents: row.amountCents,
      })),
      holdRemainderAsCredit,
    });
  }

  async updatePayment(payment: Payment): Promise<void> {
    const normalized = toPayment(payment);
    if (!this.paymentsById.has(normalized.id)) {
      throw new Error(`Payment ${normalized.id} not found`);
    }
    this.paymentsById.set(normalized.id, normalized);
    const existingRecord = [...this.paymentsByKey.values()].find(
      (record) => record.payment.id === normalized.id,
    );
    if (existingRecord !== undefined) {
      this.paymentsByKey.set(
        paymentKey(normalized.organizationId, normalized.idempotencyKey),
        {
          ...existingRecord,
          payment: normalized,
        },
      );
    }
  }

  async insertApplication(application: PaymentApplication): Promise<void> {
    const normalized = {
      id: PaymentApplicationId.parse(application.id),
      paymentId: PaymentId.parse(application.paymentId),
      invoiceId: InvoiceId.parse(application.invoiceId),
      amount: Money.fromMinorUnits(
        application.amount.amountMinor,
        application.amount.currency,
      ),
      createdAt: new Date(application.createdAt.getTime()),
    };
    const invoiceRows = this.applicationsByInvoice.get(normalized.invoiceId) ?? [];
    invoiceRows.push(normalized);
    this.applicationsByInvoice.set(normalized.invoiceId, invoiceRows);
    const paymentRows = this.applicationsByPayment.get(normalized.paymentId) ?? [];
    paymentRows.push(normalized);
    this.applicationsByPayment.set(normalized.paymentId, paymentRows);
  }

  async listAdjustments(invoiceId: InvoiceId): Promise<readonly InvoiceAdjustment[]> {
    return [...(this.adjustmentsByInvoice.get(invoiceId) ?? [])];
  }

  async insertAdjustment(adjustment: InvoiceAdjustment): Promise<void> {
    const rows = this.adjustmentsByInvoice.get(adjustment.invoiceId) ?? [];
    rows.push({
      id: InvoiceAdjustmentId.parse(adjustment.id),
      organizationId: OrganizationId.parse(adjustment.organizationId),
      invoiceId: InvoiceId.parse(adjustment.invoiceId),
      kind: adjustment.kind,
      amountCents: adjustment.amountCents,
      currency: adjustment.currency,
      reason: adjustment.reason,
      createdAt: new Date(adjustment.createdAt.getTime()),
      createdBy: adjustment.createdBy,
    });
    this.adjustmentsByInvoice.set(adjustment.invoiceId, rows);
  }

  async findActivePaymentPlan(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<PaymentPlan | null> {
    for (const plan of this.paymentPlans.values()) {
      if (
        plan.organizationId === organizationId &&
        plan.customerId === customerId &&
        plan.endedAt === null
      ) {
        return plan;
      }
    }
    return null;
  }

  async findPaymentPlanById(
    organizationId: OrganizationId,
    planId: PaymentPlanId,
  ): Promise<PaymentPlan | null> {
    const plan = this.paymentPlans.get(planId);
    if (plan === undefined || plan.organizationId !== organizationId) {
      return null;
    }
    return plan;
  }

  async insertPaymentPlan(plan: PaymentPlan): Promise<void> {
    this.paymentPlans.set(PaymentPlanId.parse(plan.id), {
      id: PaymentPlanId.parse(plan.id),
      organizationId: OrganizationId.parse(plan.organizationId),
      customerId: CustomerId.parse(plan.customerId),
      frequency: plan.frequency,
      installmentAmountCents: plan.installmentAmountCents,
      currency: plan.currency,
      startsOn: new Date(plan.startsOn.getTime()),
      endedAt: plan.endedAt ? new Date(plan.endedAt.getTime()) : null,
      createdAt: new Date(plan.createdAt.getTime()),
      createdBy: plan.createdBy,
    });
  }

  async endPaymentPlan(planId: PaymentPlanId, endedAt: Date): Promise<void> {
    const plan = this.paymentPlans.get(planId);
    if (plan === undefined) {
      throw new Error(`Payment plan ${planId} not found`);
    }
    this.paymentPlans.set(planId, {
      ...plan,
      endedAt: new Date(endedAt.getTime()),
    });
  }

  async listPaymentsByCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<readonly Payment[]> {
    return [...this.paymentsById.values()].filter(
      (payment) =>
        payment.organizationId === organizationId && payment.customerId === customerId,
    );
  }

  setPaymentIdempotencyRecord(
    organizationId: OrganizationId,
    key: string,
    record: PaymentIdempotencyRecord,
  ): void {
    this.paymentsByKey.set(paymentKey(organizationId, key), record);
  }
}
