import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq, sql } from "drizzle-orm";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import { orderLines, orders } from "../persistence/schema.js";
import type { SalesDrizzle } from "./drizzle-sales-orders.js";

export class DrizzleOpenOrderExposureReadAdapter implements IOpenOrderExposureReadPort {
  constructor(private readonly db: SalesDrizzle) {}

  async getOpenOrderExposureCents(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    const [row] = await this.db
      .select({
        totalCents: sql<number>`coalesce(sum(${orderLines.qty} * ${orderLines.unitPriceCents}), 0)`,
      })
      .from(orders)
      .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.customerId, customerId),
          eq(orders.status, "confirmed"),
        ),
      );
    return row?.totalCents ?? 0;
  }
}
