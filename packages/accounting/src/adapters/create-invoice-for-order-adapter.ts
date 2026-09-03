import type {
  AccountingCommandResult,
  CreateInvoiceForOrderCommand,
  IAccountingCommandPort,
} from "@dc-inventory/sales";
import type { IClock } from "../domain/clock.js";
import type { ICustomerBillToSnapshotReadPort } from "../domain/ports/customer-bill-to-snapshot-read.js";
import type { ICustomerTermsReadPort } from "../domain/ports/customer-terms-read.js";
import type { IInvoiceRepository } from "../domain/ports/invoice-repository.js";
import { createPostedInvoice } from "../application/create-posted-invoice.js";

export class CreateInvoiceForOrderAdapter implements IAccountingCommandPort {
  constructor(
    private readonly invoices: IInvoiceRepository,
    private readonly billToSnapshot: ICustomerBillToSnapshotReadPort,
    private readonly customerTerms: ICustomerTermsReadPort,
    private readonly clock?: IClock,
  ) {}

  async createInvoiceForOrder(
    command: CreateInvoiceForOrderCommand,
  ): Promise<AccountingCommandResult> {
    const result = await createPostedInvoice(
      {
        organizationId: command.organizationId,
        orderId: command.orderId,
        customerId: command.customerId,
        subtotalCents: command.subtotalCents,
        currency: command.currency,
      },
      {
        invoices: this.invoices,
        billToSnapshot: this.billToSnapshot,
        customerTerms: this.customerTerms,
        clock: this.clock,
      },
    );
    if (!result.ok) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      invoiceId: result.invoice.id,
      documentNumber: result.invoice.documentNumber,
      created: result.created,
    };
  }
}
