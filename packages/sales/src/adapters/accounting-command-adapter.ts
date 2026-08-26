import type { IInvoiceRepository, Invoice } from "@dc-inventory/accounting";
import { CustomerId, InvoiceId, Money, OrderId } from "@dc-inventory/shared-kernel";
import type {
  AccountingCommandResult,
  CreateInvoiceForOrderCommand,
  IAccountingCommandPort,
} from "../domain/ports/sales-order-repository.js";
import type { IClock } from "../domain/clock.js";
import { newUuid } from "../domain/ids.js";

export class AccountingCommandAdapter implements IAccountingCommandPort {
  constructor(
    private readonly invoices: IInvoiceRepository,
    private readonly clock?: IClock,
  ) {}

  async createInvoiceForOrder(
    command: CreateInvoiceForOrderCommand,
  ): Promise<AccountingCommandResult> {
    if (
      !Number.isInteger(command.subtotalCents) ||
      command.subtotalCents < 0 ||
      command.currency.trim().length !== 3
    ) {
      return { ok: false, reason: "invalid" };
    }

    const existing = await this.invoices.findByOrderId(
      command.organizationId,
      command.orderId,
    );
    if (existing !== null) {
      return {
        ok: true,
        invoiceId: existing.id,
        documentNumber: existing.documentNumber,
        created: false,
      };
    }

    const currency = command.currency.trim().toUpperCase();
    const subtotal = Money.fromMinorUnits(command.subtotalCents, currency);
    const zero = Money.fromMinorUnits(0, currency);
    const documentNumber = await this.invoices.nextDocumentNumber(command.organizationId);
    const invoice: Invoice = {
      id: InvoiceId.parse(newUuid()),
      organizationId: command.organizationId,
      orderId: OrderId.parse(command.orderId),
      customerId: CustomerId.parse(command.customerId),
      documentNumber,
      status: "posted",
      postedAt: this.clock?.now() ?? new Date(),
      subtotal,
      taxTotal: zero,
      total: subtotal,
    };
    await this.invoices.save(invoice);
    return {
      ok: true,
      invoiceId: invoice.id,
      documentNumber: invoice.documentNumber,
      created: true,
    };
  }
}
