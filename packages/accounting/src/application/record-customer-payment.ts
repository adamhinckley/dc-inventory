import {
  CustomerId,
  InvoiceId,
  Money,
  OrganizationId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, PaymentId } from "../domain/ids.js";
import type { PaymentMethod } from "../domain/invoice.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";
import type { Payment } from "../domain/invoice.js";
import {
  remainingForInvoices,
  sameCustomerPaymentPayload,
  type CustomerPaymentPayload,
} from "./customer-payment-support.js";

export type CustomerPaymentApplicationInput = {
  readonly invoiceId: InvoiceId;
  readonly amountCents: number;
};

export type RecordCustomerPaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  customerId: CustomerId;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  receivedAt?: Date;
  idempotencyKey: string;
  holdRemainderAsCredit: boolean;
  applications: readonly CustomerPaymentApplicationInput[];
};

export type RecordCustomerPaymentResult =
  | {
      ok: true;
      paymentId: PaymentId;
      unappliedCents: number;
      remainingByInvoiceId: Readonly<Record<string, number>>;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid"
        | "conflict"
        | "overpay"
        | "wrong_currency";
    };

export class RecordCustomerPaymentUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: RecordCustomerPaymentRequest): Promise<RecordCustomerPaymentResult> {
    const key = input.idempotencyKey.trim();
    if (
      key.length === 0 ||
      !Number.isInteger(input.amountCents) ||
      input.amountCents <= 0 ||
      input.currency.trim().length !== 3
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (input.applications.length === 0 && !input.holdRemainderAsCredit) {
      return { ok: false, reason: "invalid" };
    }

    const currency = input.currency.trim().toUpperCase();
    const createdAt = this.clock?.now() ?? new Date();
    const receivedAtForPayment = input.receivedAt ?? createdAt;
    const reference = input.reference?.trim() ? input.reference.trim() : null;
    const note = input.note?.trim() ? input.note.trim() : null;
    const payload: CustomerPaymentPayload = {
      customerId: input.customerId,
      amountCents: input.amountCents,
      currency,
      method: input.method,
      reference,
      note,
      ...(input.receivedAt !== undefined ? { receivedAt: input.receivedAt } : {}),
      holdRemainderAsCredit: input.holdRemainderAsCredit,
      applications: input.applications.map((row) => ({
        invoiceId: row.invoiceId,
        amountCents: row.amountCents,
      })),
    };

    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const existingPayment = await invoices.findPaymentByIdempotencyKey(
        input.organizationId,
        key,
      );
      if (existingPayment !== null) {
        if (!sameCustomerPaymentPayload(existingPayment, payload)) {
          return { ok: false, reason: "conflict" };
        }
        const remainingByInvoiceId = await this.loadRemainingByInvoice(
          invoices,
          input.organizationId,
          input.applications.map((row) => row.invoiceId),
        );
        const paymentApplications = await invoices.listApplicationsByPayment(
          input.organizationId,
          existingPayment.payment.id,
        );
        return {
          ok: true,
          paymentId: existingPayment.payment.id,
          unappliedCents: existingPayment.payment.amount.amountMinor -
            paymentApplications.reduce((sum, row) => sum + row.amount.amountMinor, 0),
          remainingByInvoiceId,
        };
      }

      let appliedTotal = 0;
      const totalsByInvoice = new Map<InvoiceId, number>();
      for (const application of input.applications) {
        if (!Number.isInteger(application.amountCents) || application.amountCents <= 0) {
          return { ok: false, reason: "invalid" };
        }
        appliedTotal += application.amountCents;
        totalsByInvoice.set(
          application.invoiceId,
          (totalsByInvoice.get(application.invoiceId) ?? 0) + application.amountCents,
        );
      }

      const invoiceIds = [...totalsByInvoice.keys()];
      const invoiceMap = await invoices.findByIdsForPayment(input.organizationId, invoiceIds);
      for (const application of input.applications) {
        const invoice = invoiceMap.get(application.invoiceId);
        if (invoice === undefined || invoice.customerId !== input.customerId) {
          return { ok: false, reason: "not_found" };
        }
        if (invoice.total.currency !== currency) {
          return { ok: false, reason: "wrong_currency" };
        }
      }

      const remainingBefore = await remainingForInvoices(
        invoices,
        input.organizationId,
        invoiceIds,
        invoiceMap,
      );
      for (const [invoiceId, totalForInvoice] of totalsByInvoice) {
        const remaining = remainingBefore.get(invoiceId);
        if (remaining === null || remaining === undefined || totalForInvoice > remaining) {
          return { ok: false, reason: "overpay" };
        }
      }

      if (appliedTotal > input.amountCents) {
        return { ok: false, reason: "invalid" };
      }
      if (appliedTotal < input.amountCents && !input.holdRemainderAsCredit) {
        return { ok: false, reason: "invalid" };
      }

      const payment: Payment = {
        id: PaymentId.parse(newUuid()),
        organizationId: input.organizationId,
        customerId: input.customerId,
        amount: Money.fromMinorUnits(input.amountCents, currency),
        method: input.method,
        reference,
        receivedAt: receivedAtForPayment,
        note,
        recordedBy: input.staffUserId,
        idempotencyKey: key,
        createdAt,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      };

      await invoices.insertPaymentWithApplications(
        payment,
        payload.applications,
        input.holdRemainderAsCredit,
      );

      const remainingByInvoiceId: Record<string, number> = {};
      for (const [invoiceId, totalForInvoice] of totalsByInvoice) {
        const before = remainingBefore.get(invoiceId);
        if (before !== null && before !== undefined) {
          remainingByInvoiceId[String(invoiceId)] = before - totalForInvoice;
        }
      }

      return {
        ok: true,
        paymentId: payment.id,
        unappliedCents: input.amountCents - appliedTotal,
        remainingByInvoiceId,
      };
    });
  }

  private async loadRemainingByInvoice(
    invoices: AccountingUnitOfWorkWithCustomerPayments["invoices"],
    organizationId: OrganizationId,
    invoiceIds: readonly InvoiceId[],
  ): Promise<Readonly<Record<string, number>>> {
    const remainingByInvoiceId: Record<string, number> = {};
    const remaining = await remainingForInvoices(invoices, organizationId, invoiceIds);
    for (const [invoiceId, value] of remaining) {
      if (value !== null) {
        remainingByInvoiceId[String(invoiceId)] = value;
      }
    }
    return remainingByInvoiceId;
  }
}
