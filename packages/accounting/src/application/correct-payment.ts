import { InvoiceId, Money } from "@dc-inventory/shared-kernel";
import { PaymentApplicationId } from "../domain/ids.js";
import { computeRemainingCents } from "../domain/invoice.js";
import type { IAccountingUnitOfWork } from "../domain/ports/invoice-repository.js";
import type { PaymentApplication } from "../domain/invoice.js";

export type CorrectPaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  invoiceId: InvoiceId;
  paymentId: import("../domain/ids.js").PaymentId;
  correctionAmountCents: number;
  currency: string;
};

export type CorrectPaymentResult =
  | { ok: true; remainingCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "wrong_currency" };

export class CorrectPaymentUseCase {
  constructor(private readonly unitOfWork: IAccountingUnitOfWork) {}

  async execute(input: CorrectPaymentRequest): Promise<CorrectPaymentResult> {
    void input.staffUserId;
    if (
      !Number.isInteger(input.correctionAmountCents) ||
      input.correctionAmountCents === 0 ||
      input.currency.trim().length !== 3
    ) {
      return { ok: false, reason: "invalid" };
    }

    return this.unitOfWork.run(async (uow) => {
      const invoice = await uow.invoices.findById(input.invoiceId);
      if (invoice === null) {
        return { ok: false, reason: "not_found" };
      }

      const currency = input.currency.trim().toUpperCase();
      if (currency !== invoice.total.currency) {
        return { ok: false, reason: "wrong_currency" };
      }

      const applications = await uow.invoices.listApplications(invoice.id);
      const hasPayment = applications.some((row) => row.paymentId === input.paymentId);
      if (!hasPayment) {
        return { ok: false, reason: "not_found" };
      }

      const paymentApplied = applications
        .filter((row) => row.paymentId === input.paymentId)
        .reduce((sum, row) => sum + row.amount.amountMinor, 0);
      if (paymentApplied + input.correctionAmountCents < 0) {
        return { ok: false, reason: "invalid" };
      }

      const applied = applications.reduce((sum, row) => sum + row.amount.amountMinor, 0);
      const afterApplied = applied + input.correctionAmountCents;
      if (afterApplied < 0 || afterApplied > invoice.total.amountMinor) {
        return { ok: false, reason: "invalid" };
      }

      const compensating: PaymentApplication = {
        id: PaymentApplicationId.parse(crypto.randomUUID()),
        paymentId: input.paymentId,
        invoiceId: invoice.id,
        amount: Money.fromMinorUnits(input.correctionAmountCents, currency),
      };
      await uow.invoices.insertApplication(compensating);

      const updatedApplications = await uow.invoices.listApplications(invoice.id);
      return {
        ok: true,
        remainingCents: computeRemainingCents(invoice, updatedApplications),
      };
    });
  }
}
