import type { IAvailableCreditReadPort, IClock } from "@dc-inventory/accounting";
import type { ICreditCheckPort } from "@dc-inventory/sales";
import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export class SalesCreditCheckAdapter implements ICreditCheckPort {
  constructor(
    private readonly availableCreditRead: IAvailableCreditReadPort,
    private readonly clock: IClock,
  ) {}

  async availableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    return this.availableCreditRead.getAvailableCreditCents({
      organizationId,
      customerId,
      asOf: this.clock.now(),
    });
  }
}
