import { CustomerId, type OrganizationId } from "@dc-inventory/shared-kernel";
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
        totalCents: sql<number>`coalesce(sum((${orderLines.qty} * ${orderLines.unitPriceCents})::bigint), 0)::int`,
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

  async listOpenOrderExposureCentsByCustomer(
    organizationId: OrganizationId,
  ): Promise<ReadonlyMap<CustomerId, number>> {
    const rows = await this.db
      .select({
        customerId: orders.customerId,
        totalCents: sql<number>`coalesce(sum((${orderLines.qty} * ${orderLines.unitPriceCents})::bigint), 0)::int`,
      })
      .from(orders)
      .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(and(eq(orders.organizationId, organizationId), eq(orders.status, "confirmed")))
      .groupBy(orders.customerId);

    return new Map(
      rows.map((row) => [CustomerId.parse(row.customerId), Number(row.totalCents)] as const),
    );
  }
}
