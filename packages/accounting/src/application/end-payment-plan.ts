import { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { PaymentPlanId } from "../domain/ids.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";

export type EndPaymentPlanRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  planId: PaymentPlanId;
  endedAt?: Date;
};

export type EndPaymentPlanResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "conflict" };

export class EndPaymentPlanUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: EndPaymentPlanRequest): Promise<EndPaymentPlanResult> {
    void input.staffUserId;
    const endedAt = input.endedAt ?? this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const plan = await invoices.findPaymentPlanById(input.organizationId, input.planId);
      if (plan === null) {
        return { ok: false, reason: "not_found" };
      }
      if (plan.endedAt !== null) {
        return { ok: false, reason: "conflict" };
      }

      await invoices.endPaymentPlan(input.planId, endedAt);
      return { ok: true };
    });
  }
}
