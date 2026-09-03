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
  billToSnapshot?: ICustomerBillToSnapshotReadPort;
  customerTerms?: ICustomerTermsReadPort;
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

  const postedAt = deps.clock?.now() ?? new Date();
  const currency = input.currency.trim().toUpperCase();
  const subtotal = Money.fromMinorUnits(input.subtotalCents, currency);
  const zero = Money.fromMinorUnits(0, currency);

  let billLine1: string | null = null;
  let billLine2: string | null = null;
  let billCity: string | null = null;
  let billRegion: string | null = null;
  let billPostal: string | null = null;
  let billCountry: string | null = null;
  let dueDate: Date | null = null;
  let terms: string | null = null;

  if (deps.billToSnapshot !== undefined && deps.customerTerms !== undefined) {
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
    terms = customerTerms;
    dueDate = computeDueDateFromTerms(postedAt, terms);
    billLine1 = billTo.line1;
    billLine2 = billTo.line2;
    billCity = billTo.city;
    billRegion = billTo.region;
    billPostal = billTo.postal;
    billCountry = billTo.country;
  }

  const invoice = await deps.invoices.insertWithNextDocumentNumber({
    id: InvoiceId.parse(newUuid()),
    organizationId: input.organizationId,
    orderId: input.orderId,
    customerId: input.customerId,
    status: "posted",
    postedAt,
    billLine1,
    billLine2,
    billCity,
    billRegion,
    billPostal,
    billCountry,
    dueDate,
    terms,
    subtotal,
    taxTotal: zero,
    total: subtotal,
  });
  return { ok: true, invoice, created: true };
}
