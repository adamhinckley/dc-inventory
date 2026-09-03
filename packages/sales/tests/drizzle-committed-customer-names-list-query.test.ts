import { customers } from "@dc-inventory/customers/schema";
import { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import type { SalesDrizzle } from "../src/adapters/drizzle-sales-orders.js";
import { buildCommittedCustomerNamesQuery } from "../src/persistence/committed-customer-names-sql.js";
import { orderLines, orders } from "../src/persistence/schema.js";

describe("buildCommittedCustomerNamesQuery", () => {
  it("joins confirmed order lines to customers for the requested SKU set", () => {
    const db = drizzle.mock({
      schema: { customers, orderLines, orders },
    }) as unknown as SalesDrizzle;

    const sql = buildCommittedCustomerNamesQuery(db, OrganizationId.DEFAULT, [
      Sku.parse("SHORT-A"),
      Sku.parse("SHORT-B"),
    ]).toSQL();

    expect(sql.sql).toContain('"sales"."orders"');
    expect(sql.sql).toContain('"sales"."order_lines"');
    expect(sql.sql).toContain('"customers"."customers"');
    expect(sql.sql).toContain("distinct");
    expect(sql.params).toContain("confirmed");
    expect(sql.params).toContain("SHORT-A");
    expect(sql.params).toContain("SHORT-B");
  });
});
