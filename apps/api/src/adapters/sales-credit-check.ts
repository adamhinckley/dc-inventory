import type { GetCustomerAccountingSummaryUseCase } from "@dc-inventory/accounting";
import type { ICreditCheckPort } from "@dc-inventory/sales";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export class SalesCreditCheckAdapter implements ICreditCheckPort {
  constructor(
    private readonly getCustomerAccountingSummary: GetCustomerAccountingSummaryUseCase,
  ) {}

  async availableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    const summary = await this.getCustomerAccountingSummary.execute({
      organizationId,
      customerId,
      asOf: new Date(),
    });
    return summary.availableCreditCents;
  }
}
