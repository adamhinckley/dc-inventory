import { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { PaymentId } from "../domain/ids.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";

export type VoidPaymentRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  paymentId: PaymentId;
  voidReason: string;
};

export type VoidPaymentResult =
  | { ok: true; unappliedCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "conflict" };

export class VoidPaymentUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: VoidPaymentRequest): Promise<VoidPaymentResult> {
    const reason = input.voidReason.trim();
    if (reason.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    const voidedAt = this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const payment = await invoices.findPaymentById(input.organizationId, input.paymentId);
      if (payment === null) {
        return { ok: false, reason: "not_found" };
      }
      if (payment.voidedAt != null) {
        return { ok: false, reason: "conflict" };
      }

      await invoices.updatePayment({
        ...payment,
        voidedAt,
        voidedBy: input.staffUserId,
        voidReason: reason,
      });

      return {
        ok: true,
        unappliedCents: 0,
      };
    });
  }
}
