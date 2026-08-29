import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { newUuid, PaymentApplicationId, PaymentId } from "../domain/ids.js";
import type {
  IInvoiceRepository,
  PaymentIdempotencyRecord,
} from "../domain/ports/invoice-repository.js";
import type { Invoice, Payment, PaymentApplication } from "../domain/invoice.js";

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

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private readonly byId = new Map<InvoiceId, StoredInvoice>();
  private readonly byOrderId = new Map<OrderId, InvoiceId>();
  private readonly applicationsByInvoice = new Map<InvoiceId, PaymentApplication[]>();
  private readonly paymentsByKey = new Map<string, PaymentIdempotencyRecord>();
  private readonly nextSequenceByOrg = new Map<string, number>();

  snapshot(): {
    byId: Map<InvoiceId, StoredInvoice>;
    byOrderId: Map<OrderId, InvoiceId>;
    applicationsByInvoice: Map<InvoiceId, PaymentApplication[]>;
    paymentsByKey: Map<string, PaymentIdempotencyRecord>;
    nextSequenceByOrg: Map<string, number>;
  } {
    const applicationsByInvoice = new Map<InvoiceId, PaymentApplication[]>();
    for (const [id, rows] of this.applicationsByInvoice) {
      applicationsByInvoice.set(id, [...rows]);
    }
    return {
      byId: new Map(this.byId),
      byOrderId: new Map(this.byOrderId),
      applicationsByInvoice,
      paymentsByKey: new Map(this.paymentsByKey),
      nextSequenceByOrg: new Map(this.nextSequenceByOrg),
    };
  }

  restore(snapshot: {
    byId: Map<InvoiceId, StoredInvoice>;
    byOrderId: Map<OrderId, InvoiceId>;
    applicationsByInvoice: Map<InvoiceId, PaymentApplication[]>;
    paymentsByKey: Map<string, PaymentIdempotencyRecord>;
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
    this.paymentsByKey.clear();
    for (const [key, record] of snapshot.paymentsByKey) {
      this.paymentsByKey.set(key, record);
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

  async nextDocumentNumber(organizationId: OrganizationId): Promise<string> {
    const orgKey = organizationId;
    const next = this.nextSequenceByOrg.get(orgKey) ?? 1;
    const number = formatDocumentNumber(next);
    this.nextSequenceByOrg.set(orgKey, next + 1);
    return number;
  }

  async listApplications(invoiceId: InvoiceId): Promise<readonly PaymentApplication[]> {
    return [...(this.applicationsByInvoice.get(invoiceId) ?? [])];
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
    const application: PaymentApplication = {
      id: PaymentApplicationId.parse(newUuid()),
      paymentId: payment.id,
      invoiceId,
      amount: Money.fromMinorUnits(applicationAmountCents, payment.amount.currency),
      createdAt: new Date(payment.createdAt.getTime()),
    };
    const rows = this.applicationsByInvoice.get(invoiceId) ?? [];
    rows.push(application);
    this.applicationsByInvoice.set(invoiceId, rows);
    this.paymentsByKey.set(paymentKey(payment.organizationId, payment.idempotencyKey), {
      payment,
      invoiceId,
      applicationAmountCents,
    });
  }

  async insertApplication(application: PaymentApplication): Promise<void> {
    const rows = this.applicationsByInvoice.get(application.invoiceId) ?? [];
    rows.push({
      id: PaymentApplicationId.parse(application.id),
      paymentId: PaymentId.parse(application.paymentId),
      invoiceId: InvoiceId.parse(application.invoiceId),
      amount: Money.fromMinorUnits(
        application.amount.amountMinor,
        application.amount.currency,
      ),
      createdAt: new Date(application.createdAt.getTime()),
    });
    this.applicationsByInvoice.set(application.invoiceId, rows);
  }
}
