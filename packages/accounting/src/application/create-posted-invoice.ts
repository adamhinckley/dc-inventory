import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { computeDueDateFromTerms } from "../domain/due-date.js";
import { newUuid } from "../domain/ids.js";
import type { ICustomerBillToSnapshotReadPort } from "../domain/ports/customer-bill-to-snapshot-read.js";
import type { ICustomerTermsReadPort } from "../domain/ports/customer-terms-read.js";
import type { IInvoiceRepository } from "../domain/ports/invoice-repository.js";
import type { Invoice } from "../domain/invoice.js";

export type CreatePostedInvoiceInput = {
  organizationId: OrganizationId;
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type CreatePostedInvoiceResult =
  | { ok: true; invoice: Invoice; created: boolean }
  | { ok: false; reason: "invalid" };

type CreatePostedInvoiceDeps = {
  invoices: IInvoiceRepository;
  billToSnapshot: ICustomerBillToSnapshotReadPort;
  customerTerms: ICustomerTermsReadPort;
  clock?: IClock;
};

export async function createPostedInvoice(
  input: CreatePostedInvoiceInput,
  deps: CreatePostedInvoiceDeps,
): Promise<CreatePostedInvoiceResult> {
  if (
    !Number.isInteger(input.subtotalCents) ||
    input.subtotalCents < 0 ||
    input.currency.trim().length !== 3
  ) {
    return { ok: false, reason: "invalid" };
  }

  const existing = await deps.invoices.findByOrderId(input.organizationId, input.orderId);
  if (existing !== null) {
    return { ok: true, invoice: existing, created: false };
  }

  const billTo = await deps.billToSnapshot.getBillToAddressSnapshot(
    input.organizationId,
    input.customerId,
  );
  if (billTo === null) {
    return { ok: false, reason: "invalid" };
  }

  const customerTerms = await deps.customerTerms.getTerms(
    input.organizationId,
    input.customerId,
  );
  if (customerTerms === null || customerTerms.trim().length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const postedAt = deps.clock?.now() ?? new Date();
  const dueDate = computeDueDateFromTerms(postedAt, customerTerms);
  if (dueDate === null) {
    return { ok: false, reason: "invalid" };
  }

  const currency = input.currency.trim().toUpperCase();
  const subtotal = Money.fromMinorUnits(input.subtotalCents, currency);
  const zero = Money.fromMinorUnits(0, currency);

  const invoice = await deps.invoices.insertWithNextDocumentNumber({
    id: InvoiceId.parse(newUuid()),
    organizationId: input.organizationId,
    orderId: input.orderId,
    customerId: input.customerId,
    status: "posted",
    postedAt,
    billLine1: billTo.line1,
    billLine2: billTo.line2,
    billCity: billTo.city,
    billRegion: billTo.region,
    billPostal: billTo.postal,
    billCountry: billTo.country,
    dueDate,
    terms: customerTerms,
    subtotal,
    taxTotal: zero,
    total: subtotal,
  });
  return { ok: true, invoice, created: true };
}
