import { InvoiceId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { PaymentApplicationId } from "../domain/ids.js";
import type { PaymentId } from "../domain/ids.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";
import type { PaymentApplication } from "../domain/invoice.js";
import { remainingForInvoice } from "./customer-payment-support.js";

export type ReallocatePaymentApplicationInput = {
  readonly invoiceId: InvoiceId;
  readonly deltaCents: number;
};

export type ReallocatePaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  paymentId: PaymentId;
  applications: readonly ReallocatePaymentApplicationInput[];
};

export type ReallocatePaymentResult =
  | { ok: true; unappliedCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "wrong_currency" | "overpay" };

export class ReallocatePaymentUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: ReallocatePaymentRequest): Promise<ReallocatePaymentResult> {
    void input.staffUserId;
    if (input.applications.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    const createdAt = this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const payment = await invoices.findPaymentById(input.organizationId, input.paymentId);
      if (payment === null || payment.voidedAt != null) {
        return { ok: false, reason: "not_found" };
      }

      const existingApplications = await invoices.listApplicationsByPayment(
        input.organizationId,
        payment.id,
      );
      const currency = payment.amount.currency;
      const appliedTotal = existingApplications.reduce(
        (sum, row) => sum + row.amount.amountMinor,
        0,
      );
      const unappliedCents = payment.amount.amountMinor - appliedTotal;
      let deltaTotal = 0;
      const deltasByInvoice = new Map<InvoiceId, number>();

      for (const change of input.applications) {
        if (!Number.isInteger(change.deltaCents) || change.deltaCents === 0) {
          return { ok: false, reason: "invalid" };
        }
        deltaTotal += change.deltaCents;

        const invoice = await invoices.findByIdForPayment(
          input.organizationId,
          change.invoiceId,
        );
        if (invoice === null || invoice.customerId !== payment.customerId) {
          return { ok: false, reason: "not_found" };
        }
        if (invoice.total.currency !== currency) {
          return { ok: false, reason: "wrong_currency" };
        }

        deltasByInvoice.set(
          change.invoiceId,
          (deltasByInvoice.get(change.invoiceId) ?? 0) + change.deltaCents,
        );
      }

      for (const [invoiceId, combinedDelta] of deltasByInvoice) {
        const currentApplied = existingApplications
          .filter((row) => row.invoiceId === invoiceId)
          .reduce((sum, row) => sum + row.amount.amountMinor, 0);
        const nextApplied = currentApplied + combinedDelta;
        if (nextApplied < 0) {
          return { ok: false, reason: "invalid" };
        }

        const remaining = await remainingForInvoice(
          invoices,
          input.organizationId,
          invoiceId,
        );
        if (remaining === null) {
          return { ok: false, reason: "not_found" };
        }
        const remainingBeforeThisPayment = remaining + currentApplied;
        if (nextApplied > remainingBeforeThisPayment) {
          return { ok: false, reason: "overpay" };
        }
      }

      if (input.applications.length === 1) {
        const singleChange = input.applications[0]!;
        if (singleChange.deltaCents > 0) {
          if (singleChange.deltaCents > unappliedCents) {
            return { ok: false, reason: "invalid" };
          }
        } else if (-singleChange.deltaCents > existingApplications
          .filter((row) => row.invoiceId === singleChange.invoiceId)
          .reduce((sum, row) => sum + row.amount.amountMinor, 0)) {
          return { ok: false, reason: "invalid" };
        }
      } else if (deltaTotal !== 0) {
        return { ok: false, reason: "invalid" };
      }

      for (const change of input.applications) {
        const application: PaymentApplication = {
          id: PaymentApplicationId.parse(crypto.randomUUID()),
          paymentId: payment.id,
          invoiceId: change.invoiceId,
          amount: Money.fromMinorUnits(change.deltaCents, currency),
          createdAt,
        };
        await invoices.insertApplication(application);
      }

      const updatedApplications = await invoices.listApplicationsByPayment(
        input.organizationId,
        payment.id,
      );
      const applied = updatedApplications.reduce((sum, row) => sum + row.amount.amountMinor, 0);
      return {
        ok: true,
        unappliedCents: payment.amount.amountMinor - applied,
      };
    });
  }
}
