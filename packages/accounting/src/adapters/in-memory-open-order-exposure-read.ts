import { CustomerId, type OrganizationId } from "@dc-inventory/shared-kernel";
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

  async listOpenOrderExposureCentsByCustomer(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, number>> {
    const prefix = `${organizationId}\0`;
    const exposureByCustomer = new Map<CustomerId, number>();
    for (const [key, exposureCents] of this.exposureByCustomer) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      exposureByCustomer.set(CustomerId.parse(key.slice(prefix.length)), exposureCents);
    }
    return exposureByCustomer;
  }
}
