import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
} from "@dc-inventory/shared-kernel";
import { newUuid } from "../domain/ids.js";
import type { IAccountingUnitOfWork } from "../domain/ports/invoice-repository.js";
import type { Invoice } from "../domain/invoice.js";

export type CreateInvoiceRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  orderId: OrderId;
  customerId: CustomerId;
  subtotalCents: number;
  currency: string;
};

export type CreateInvoiceResult =
  | { ok: true; invoice: Invoice; created: boolean }
  | { ok: false; reason: "invalid" };

export class CreateInvoiceUseCase {
  constructor(private readonly unitOfWork: IAccountingUnitOfWork) {}

  async execute(input: CreateInvoiceRequest): Promise<CreateInvoiceResult> {
    void input.staffUserId;
    if (
      !Number.isInteger(input.subtotalCents) ||
      input.subtotalCents < 0 ||
      input.currency.trim().length !== 3
    ) {
      return { ok: false, reason: "invalid" };
    }

    return this.unitOfWork.run(async (uow) => {
      const existing = await uow.invoices.findByOrderId(input.orderId);
      if (existing !== null) {
        return { ok: true, invoice: existing, created: false };
      }

      const currency = input.currency.trim().toUpperCase();
      const subtotal = Money.fromMinorUnits(input.subtotalCents, currency);
      const zero = Money.fromMinorUnits(0, currency);
      const documentNumber = await uow.invoices.nextDocumentNumber();
      const invoice: Invoice = {
        id: InvoiceId.parse(newUuid()),
        orderId: input.orderId,
        customerId: input.customerId,
        documentNumber,
        status: "posted",
        postedAt: new Date(),
        subtotal,
        taxTotal: zero,
        total: subtotal,
      };
      await uow.invoices.save(invoice);
      return { ok: true, invoice, created: true };
    });
  }
}
