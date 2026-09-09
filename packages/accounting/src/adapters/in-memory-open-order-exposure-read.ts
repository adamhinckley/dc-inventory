import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";

export class InMemoryOpenOrderExposureReadPort implements IOpenOrderExposureReadPort {
  private readonly exposureByCustomer = new Map<string, number>();

  setExposure(
    organizationId: OrganizationId,
    customerId: CustomerId,
    exposureCents: number,
  ): void {
    this.exposureByCustomer.set(`${organizationId}\0${customerId}`, exposureCents);
  }

  async getOpenOrderExposureCents(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    return this.exposureByCustomer.get(`${organizationId}\0${customerId}`) ?? 0;
  }
}
