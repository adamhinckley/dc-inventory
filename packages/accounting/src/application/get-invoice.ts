import { InvoiceId, OrganizationId } from "@dc-inventory/shared-kernel";
import { computeRemainingCents } from "../domain/invoice.js";
import type { IInvoiceRepository } from "../domain/ports/invoice-repository.js";

export type GetInvoiceRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  invoiceId: InvoiceId;
};

export type InvoiceView = {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly documentNumber: string;
  readonly status: "unposted" | "posted";
  readonly postedAt: Date | null;
  readonly subtotalCents: number;
  readonly taxTotalCents: number;
  readonly totalCents: number;
  readonly remainingCents: number;
  readonly currency: string;
};

export type GetInvoiceResult =
  | { ok: true; invoice: InvoiceView }
  | { ok: false; reason: "not_found" };

export class GetInvoiceUseCase {
  constructor(private readonly invoices: IInvoiceRepository) {}

  async execute(input: GetInvoiceRequest): Promise<GetInvoiceResult> {
    void input.staffUserId;
    const invoice = await this.invoices.findById(input.organizationId, input.invoiceId);
    if (invoice === null) {
      return { ok: false, reason: "not_found" };
    }
    const applications = await this.invoices.listApplications(invoice.id);
    const remainingCents = computeRemainingCents(invoice, applications);
    return {
      ok: true,
      invoice: {
        id: invoice.id,
        orderId: invoice.orderId,
        customerId: invoice.customerId,
        documentNumber: invoice.documentNumber,
        status: invoice.status,
        postedAt: invoice.postedAt,
        subtotalCents: invoice.subtotal.amountMinor,
        taxTotalCents: invoice.taxTotal.amountMinor,
        totalCents: invoice.total.amountMinor,
        remainingCents,
        currency: invoice.total.currency,
      },
    };
  }
}
