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
}
