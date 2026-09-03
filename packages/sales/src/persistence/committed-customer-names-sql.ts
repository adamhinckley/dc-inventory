import { customers } from "@dc-inventory/customers/schema";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { SalesDrizzle } from "../adapters/drizzle-sales-orders.js";
import { orderLines, orders } from "./schema.js";

export function buildCommittedCustomerNamesQuery(
  db: SalesDrizzle,
  organizationId: OrganizationId,
  skus: readonly Sku[],
) {
  const skuValues = skus.map((sku) => sku.value);
  return db
    .selectDistinct({
      customerId: orders.customerId,
      name: customers.name,
    })
    .from(orders)
    .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
    .innerJoin(
      customers,
      and(eq(customers.organizationId, orders.organizationId), eq(customers.id, orders.customerId)),
    )
    .where(
      and(
        eq(orders.organizationId, organizationId),
        eq(orders.status, "confirmed"),
        inArray(orderLines.sku, skuValues),
      ),
    )
    .orderBy(asc(orders.customerId));
}
