import { InvoiceId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { InvoiceAdjustmentId, newUuid } from "../domain/ids.js";
import type { InvoiceAdjustmentKind } from "../domain/invoice.js";
import { computeRemainingCents } from "../domain/invoice.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";
import type { InvoiceAdjustment } from "../domain/invoice.js";
import { collectVoidedPaymentIds } from "./customer-payment-support.js";

export type AdjustInvoiceRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  invoiceId: InvoiceId;
  kind: InvoiceAdjustmentKind;
  amountCents: number;
  reason: string;
};

export type AdjustInvoiceResult =
  | { ok: true; remainingCents: number }
  | { ok: false; reason: "not_found" | "invalid" };

export class AdjustInvoiceUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: AdjustInvoiceRequest): Promise<AdjustInvoiceResult> {
    const reason = input.reason.trim();
    if (reason.length === 0 || !Number.isInteger(input.amountCents) || input.amountCents === 0) {
      return { ok: false, reason: "invalid" };
    }

    const createdAt = this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const invoice = await invoices.findByIdForPayment(
        input.organizationId,
        input.invoiceId,
      );
      if (invoice === null) {
        return { ok: false, reason: "not_found" };
      }

      const applications = await invoices.listApplications(input.invoiceId);
      const adjustments = await invoices.listAdjustments(input.invoiceId);
      const voidedPaymentIds = await collectVoidedPaymentIds(
        invoices,
        input.organizationId,
        applications.map((row) => row.paymentId),
      );
      const remainingBefore = computeRemainingCents(
        invoice,
        applications,
        voidedPaymentIds,
        adjustments,
      );
      const remainingAfter = remainingBefore - input.amountCents;
      if (remainingAfter < 0 || remainingAfter > invoice.total.amountMinor) {
        return { ok: false, reason: "invalid" };
      }

      const adjustment: InvoiceAdjustment = {
        id: InvoiceAdjustmentId.parse(newUuid()),
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        kind: input.kind,
        amountCents: input.amountCents,
        currency: invoice.total.currency,
        reason,
        createdAt,
        createdBy: input.staffUserId,
      };
      await invoices.insertAdjustment(adjustment);

      return {
        ok: true,
        remainingCents: remainingAfter,
      };
    });
  }
}
