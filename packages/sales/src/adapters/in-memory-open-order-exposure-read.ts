import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import type { ISalesOrderRepository } from "../domain/ports/sales-order-repository.js";
import { liveSalesOrderLines } from "../domain/sales-order.js";

export class InMemoryOpenOrderExposureReadAdapter implements IOpenOrderExposureReadPort {
  constructor(private readonly orders: ISalesOrderRepository) {}

  async getOpenOrderExposureCents(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    const exposureByCustomer = await this.listOpenOrderExposureCentsByCustomer(organizationId);
    return exposureByCustomer.get(customerId) ?? 0;
  }

  async listOpenOrderExposureCentsByCustomer(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, number>> {
    const page = await this.orders.list({
      organizationId,
      page: 1,
      pageSize: 10_000,
    });
    const exposureByCustomer = new Map<CustomerId, number>();
    for (const order of page.items) {
      if (order.status !== "confirmed") {
        continue;
      }
      const lines = liveSalesOrderLines(order.lines);
      const orderTotal = lines.reduce(
        (lineSum, line) => lineSum + line.qty * line.unitPrice.amountMinor,
        0,
      );
      const current = exposureByCustomer.get(order.customerId) ?? 0;
      exposureByCustomer.set(order.customerId, current + orderTotal);
    }
    return exposureByCustomer;
  }
}
