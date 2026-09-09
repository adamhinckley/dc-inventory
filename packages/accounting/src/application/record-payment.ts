import { InvoiceId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, PaymentId } from "../domain/ids.js";
import { computeRemainingCents } from "../domain/invoice.js";
import type {
  AccountingUnitOfWorkWithCustomerPayments,
  IAccountingUnitOfWork,
} from "../domain/ports/invoice-repository.js";
import { supportsAccountingRepository } from "../domain/ports/invoice-repository.js";
import type { Payment } from "../domain/invoice.js";
import { RecordCustomerPaymentUseCase } from "./record-customer-payment.js";

export type RecordPaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  invoiceId: InvoiceId;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

export type RecordPaymentResult =
  | { ok: true; remainingCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "conflict" | "overpay" | "wrong_currency" };

export class RecordPaymentUseCase {
  private readonly recordCustomerPayment?: RecordCustomerPaymentUseCase;

  constructor(
    private readonly unitOfWork: IAccountingUnitOfWork,
    private readonly clock?: IClock,
  ) {
    if (supportsAccountingRepository(unitOfWork.invoices)) {
      this.recordCustomerPayment = new RecordCustomerPaymentUseCase(
        unitOfWork as AccountingUnitOfWorkWithCustomerPayments,
        clock,
      );
    }
  }

  async execute(input: RecordPaymentRequest): Promise<RecordPaymentResult> {
    if (this.recordCustomerPayment !== undefined) {
      const invoice = await this.unitOfWork.invoices.findByIdForPayment(
        input.organizationId,
        input.invoiceId,
      );
      if (invoice === null) {
        return { ok: false, reason: "not_found" };
      }

      const result = await this.recordCustomerPayment.execute({
        staffUserId: input.staffUserId,
        organizationId: input.organizationId,
        customerId: invoice.customerId,
        amountCents: input.amountCents,
        currency: input.currency,
        method: "other",
        idempotencyKey: input.idempotencyKey,
        holdRemainderAsCredit: false,
        applications: [{ invoiceId: input.invoiceId, amountCents: input.amountCents }],
      });

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        remainingCents: result.remainingByInvoiceId[String(input.invoiceId)] ?? 0,
      };
    }

    return this.executeLegacy(input);
  }

  private async executeLegacy(input: RecordPaymentRequest): Promise<RecordPaymentResult> {
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
      const invoice = await uow.invoices.findByIdForPayment(
        input.organizationId,
        input.invoiceId,
      );
      if (invoice === null) {
        return { ok: false, reason: "not_found" };
      }

      const existingPayment = await uow.invoices.findPaymentByIdempotencyKey(
        input.organizationId,
        key,
      );
      if (existingPayment !== null) {
        const existingInvoiceId =
          existingPayment.invoiceId ??
          existingPayment.applications?.[0]?.invoiceId;
        const existingAmount =
          existingPayment.applicationAmountCents ??
          existingPayment.applications?.[0]?.amountCents;
        if (
          existingInvoiceId !== input.invoiceId ||
          existingAmount !== input.amountCents ||
          existingPayment.payment.amount.currency !== input.currency.trim().toUpperCase()
        ) {
          return { ok: false, reason: "conflict" };
        }
        const applications = await uow.invoices.listApplications(invoice.id);
        return {
          ok: true,
          remainingCents: computeRemainingCents(invoice, applications),
        };
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
        organizationId: input.organizationId,
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
