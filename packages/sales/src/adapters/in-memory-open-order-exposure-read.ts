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
    const page = await this.orders.list({
      organizationId,
      customerId,
      page: 1,
      pageSize: 10_000,
    });
    return page.items
      .filter((order) => order.status === "confirmed")
      .reduce((sum, order) => {
        const lines = liveSalesOrderLines(order.lines);
        const orderTotal = lines.reduce(
          (lineSum, line) => lineSum + line.qty * line.unitPrice.amountMinor,
          0,
        );
        return sum + orderTotal;
      }, 0);
  }

  async listOpenOrderExposureCentsByCustomer(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, number>> {
    const exposureByCustomer = new Map<CustomerId, number>();
    let page = 1;
    while (true) {
      const result = await this.orders.list({
        organizationId,
        page,
        pageSize: 1_000,
      });
      for (const order of result.items) {
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
      if (result.items.length < 1_000) {
        break;
      }
      page += 1;
    }
    return exposureByCustomer;
  }
}
