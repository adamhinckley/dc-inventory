import { CustomerId } from "@dc-inventory/shared-kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import {
  buildShipToListByCustomerQuery,
  type CustomersDrizzle,
} from "../src/adapters/drizzle-customers.js";
import { shipTos } from "../src/persistence/schema.js";

describe("Drizzle ship-to list query", () => {
  it("orders by created_at then id", () => {
    const db = drizzle.mock({ schema: { shipTos } }) as unknown as CustomersDrizzle;
    const customerId = CustomerId.parse("550e8400-e29b-41d4-a716-446655440000");
    const query = buildShipToListByCustomerQuery(db, customerId).toSQL();

    expect(query.sql).toContain('"created_at"');
    expect(query.sql).toContain('"id"');
    expect(query.sql.toLowerCase()).toContain("order by");
  });
});
