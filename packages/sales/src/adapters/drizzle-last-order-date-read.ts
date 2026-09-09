import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, desc, eq } from "drizzle-orm";
import type { ILastOrderDateReadPort } from "@dc-inventory/accounting";
import { orders } from "../persistence/schema.js";
import type { SalesDrizzle } from "./drizzle-sales-orders.js";

export class DrizzleLastOrderDateReadAdapter implements ILastOrderDateReadPort {
  constructor(private readonly db: SalesDrizzle) {}

  async getLastOrderDate(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: orders.createdAt })
      .from(orders)
      .where(and(eq(orders.organizationId, organizationId), eq(orders.customerId, customerId)))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
  }
}
