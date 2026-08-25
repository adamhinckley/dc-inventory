import { InvoiceId, Money } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, PaymentId } from "../domain/ids.js";
import { computeRemainingCents } from "../domain/invoice.js";
import type { IAccountingUnitOfWork } from "../domain/ports/invoice-repository.js";
import type { Payment } from "../domain/invoice.js";

export type RecordPaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  invoiceId: InvoiceId;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

export type RecordPaymentResult =
  | { ok: true; remainingCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "conflict" | "overpay" | "wrong_currency" };

export class RecordPaymentUseCase {
  constructor(
    private readonly unitOfWork: IAccountingUnitOfWork,
    private readonly clock?: IClock,
  ) {}

  async execute(input: RecordPaymentRequest): Promise<RecordPaymentResult> {
    void input.staffUserId;
    const key = input.idempotencyKey.trim();
    if (key.length === 0 || !Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      return { ok: false, reason: "invalid" };
    }
    if (input.currency.trim().length !== 3) {
      return { ok: false, reason: "invalid" };
    }

    const createdAt = this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async (uow) => {
      const existingPayment = await uow.invoices.findPaymentByIdempotencyKey(key);
      if (existingPayment !== null) {
        if (
          existingPayment.invoiceId !== input.invoiceId ||
          existingPayment.applicationAmountCents !== input.amountCents ||
          existingPayment.payment.amount.currency !== input.currency.trim().toUpperCase()
        ) {
          return { ok: false, reason: "conflict" };
        }
        const invoice = await uow.invoices.findById(input.invoiceId);
        if (invoice === null) {
          return { ok: false, reason: "not_found" };
        }
        const applications = await uow.invoices.listApplications(invoice.id);
        return {
          ok: true,
          remainingCents: computeRemainingCents(invoice, applications),
        };
      }

      const invoice = await uow.invoices.findById(input.invoiceId);
      if (invoice === null) {
        return { ok: false, reason: "not_found" };
      }

      const currency = input.currency.trim().toUpperCase();
      if (currency !== invoice.total.currency) {
        return { ok: false, reason: "wrong_currency" };
      }

      const applications = await uow.invoices.listApplications(invoice.id);
      const remaining = computeRemainingCents(invoice, applications);
      if (input.amountCents > remaining) {
        return { ok: false, reason: "overpay" };
      }

      const payment: Payment = {
        id: PaymentId.parse(newUuid()),
        customerId: invoice.customerId,
        amount: Money.fromMinorUnits(input.amountCents, currency),
        idempotencyKey: key,
        createdAt,
      };
      await uow.invoices.insertPaymentWithApplication(
        payment,
        invoice.id,
        input.amountCents,
      );

      const updatedApplications = await uow.invoices.listApplications(invoice.id);
      return {
        ok: true,
        remainingCents: computeRemainingCents(invoice, updatedApplications),
      };
    });
  }
}
