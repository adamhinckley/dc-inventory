import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ILastOrderDateReadPort } from "@dc-inventory/accounting";
import type { ISalesOrderRepository } from "../domain/ports/sales-order-repository.js";

export class InMemoryLastOrderDateReadAdapter implements ILastOrderDateReadPort {
  constructor(private readonly orders: ISalesOrderRepository) {}

  async getLastOrderDate(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Date | null> {
    const page = await this.orders.list({
      organizationId,
      customerId,
      page: 1,
      pageSize: 10_000,
    });
    return page.items.reduce<Date | null>((latest, order) => {
      if (latest === null || order.createdAt > latest) {
        return order.createdAt;
      }
      return latest;
    }, null);
  }
}
