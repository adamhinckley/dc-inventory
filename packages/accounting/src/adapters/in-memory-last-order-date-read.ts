import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ILastOrderDateReadPort } from "../domain/ports/last-order-date-read.js";

export class InMemoryLastOrderDateReadPort implements ILastOrderDateReadPort {
  private readonly lastOrderDateByCustomer = new Map<string, Date>();

  setLastOrderDate(
    organizationId: OrganizationId,
    customerId: CustomerId,
    date: Date | null,
  ): void {
    const key = `${organizationId}\0${customerId}`;
    if (date === null) {
      this.lastOrderDateByCustomer.delete(key);
      return;
    }
    this.lastOrderDateByCustomer.set(key, date);
  }

  async getLastOrderDate(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Date | null> {
    return this.lastOrderDateByCustomer.get(`${organizationId}\0${customerId}`) ?? null;
  }
}
