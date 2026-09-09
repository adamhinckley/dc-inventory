import { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, PaymentPlanId } from "../domain/ids.js";
import type { PaymentPlanFrequency } from "../domain/invoice.js";
import type { AccountingUnitOfWorkWithCustomerPayments } from "../domain/ports/invoice-repository.js";
import type { PaymentPlan } from "../domain/invoice.js";

export type SetPaymentPlanRequest = {
  staffUserId: import("@dc-inventory/shared-kernel").StaffUserId;
  organizationId: OrganizationId;
  customerId: CustomerId;
  frequency: PaymentPlanFrequency;
  installmentAmountCents: number;
  currency: string;
  startsOn: Date;
};

export type SetPaymentPlanResult =
  | { ok: true; plan: PaymentPlan }
  | { ok: false; reason: "invalid" | "conflict" };

export class SetPaymentPlanUseCase {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWorkWithCustomerPayments,
    private readonly clock?: IClock,
  ) {}

  async execute(input: SetPaymentPlanRequest): Promise<SetPaymentPlanResult> {
    if (
      !Number.isInteger(input.installmentAmountCents) ||
      input.installmentAmountCents <= 0 ||
      input.currency.trim().length !== 3
    ) {
      return { ok: false, reason: "invalid" };
    }

    const createdAt = this.clock?.now() ?? new Date();
    return this.unitOfWork.run(async () => {
      const invoices = this.unitOfWork.invoices;
      const active = await invoices.findActivePaymentPlan(
        input.organizationId,
        input.customerId,
      );
      if (active !== null) {
        return { ok: false, reason: "conflict" };
      }

      const plan: PaymentPlan = {
        id: PaymentPlanId.parse(newUuid()),
        organizationId: input.organizationId,
        customerId: input.customerId,
        frequency: input.frequency,
        installmentAmountCents: input.installmentAmountCents,
        currency: input.currency.trim().toUpperCase(),
        startsOn: input.startsOn,
        endedAt: null,
        createdAt,
        createdBy: input.staffUserId,
      };
      await invoices.insertPaymentPlan(plan);
      return { ok: true, plan };
    });
  }
}
