import type { GetCustomerAccountingSummaryUseCase, IClock } from "@dc-inventory/accounting";
import type { ICreditCheckPort } from "@dc-inventory/sales";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export class SalesCreditCheckAdapter implements ICreditCheckPort {
  constructor(
    private readonly getCustomerAccountingSummary: GetCustomerAccountingSummaryUseCase,
    private readonly clock: IClock,
  ) {}

  async availableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    const summary = await this.getCustomerAccountingSummary.execute({
      organizationId,
      customerId,
      asOf: this.clock.now(),
    });
    return summary.availableCreditCents;
  }
}
