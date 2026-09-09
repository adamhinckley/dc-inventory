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
  collectVoidedPaymentIds,
  remainingForInvoice,
  sameCustomerPaymentPayload,
  type CustomerPaymentPayload,
} from "./customer-payment-support.js";
import { computeRemainingCents } from "../domain/invoice.js";

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
        const applicationsByInvoice = await this.loadRemainingByInvoice(
          invoices,
          input.organizationId,
          input.applications.map((row) => row.invoiceId),
        );
        const paymentApplications = await invoices.listApplicationsByPayment(
          existingPayment.payment.id,
        );
        return {
          ok: true,
          paymentId: existingPayment.payment.id,
          unappliedCents: existingPayment.payment.amount.amountMinor -
            paymentApplications.reduce((sum, row) => sum + row.amount.amountMinor, 0),
          remainingByInvoiceId: applicationsByInvoice,
        };
      }

      let appliedTotal = 0;
      const totalsByInvoice = new Map<InvoiceId, number>();
      for (const application of input.applications) {
        if (!Number.isInteger(application.amountCents) || application.amountCents <= 0) {
          return { ok: false, reason: "invalid" };
        }
        appliedTotal += application.amountCents;
        const invoice = await invoices.findByIdForPayment(
          input.organizationId,
          application.invoiceId,
        );
        if (invoice === null || invoice.customerId !== input.customerId) {
          return { ok: false, reason: "not_found" };
        }
        if (invoice.total.currency !== currency) {
          return { ok: false, reason: "wrong_currency" };
        }
        totalsByInvoice.set(
          application.invoiceId,
          (totalsByInvoice.get(application.invoiceId) ?? 0) + application.amountCents,
        );
      }

      for (const [invoiceId, totalForInvoice] of totalsByInvoice) {
        const remaining = await remainingForInvoice(
          invoices,
          input.organizationId,
          invoiceId,
        );
        if (remaining === null || totalForInvoice > remaining) {
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

      const remainingByInvoiceId = await this.loadRemainingByInvoice(
        invoices,
        input.organizationId,
        input.applications.map((row) => row.invoiceId),
      );

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
    for (const invoiceId of invoiceIds) {
      const invoice = await invoices.findByIdForPayment(organizationId, invoiceId);
      if (invoice === null) {
        continue;
      }
      const applications = await invoices.listApplications(invoiceId);
      const adjustments = await invoices.listAdjustments(invoiceId);
      const voidedPaymentIds = await collectVoidedPaymentIds(
        invoices,
        organizationId,
        applications.map((row) => row.paymentId),
      );
      remainingByInvoiceId[String(invoiceId)] = computeRemainingCents(
        invoice,
        applications,
        voidedPaymentIds,
        adjustments,
      );
    }
    return remainingByInvoiceId;
  }
}
