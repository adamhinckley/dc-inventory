import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invoices, payments } from "@dc-inventory/accounting/schema";
import { customers } from "@dc-inventory/customers/schema";
import { orders } from "@dc-inventory/sales/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");

function constraintNames(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table);
  return {
    foreignKeys: config.foreignKeys.map((key) => key.getName()),
    uniqueConstraints: config.uniqueConstraints.map((constraint) => constraint.name),
  };
}

describe("organization-scoped persistence references", () => {
  it("declares the composite keys and foreign keys in Drizzle", () => {
    expect(constraintNames(customers).uniqueConstraints).toContain(
      "customers_organization_id_id_unique",
    );
    expect(constraintNames(orders)).toEqual(
      expect.objectContaining({
        foreignKeys: ["orders_organization_id_customer_id_customers_fk"],
        uniqueConstraints: ["orders_organization_id_id_unique"],
      }),
    );
    expect(constraintNames(invoices).foreignKeys).toEqual(
      expect.arrayContaining([
        "invoices_organization_id_order_id_orders_fk",
        "invoices_organization_id_customer_id_customers_fk",
      ]),
    );
    expect(constraintNames(payments).foreignKeys).toContain(
      "payments_organization_id_customer_id_customers_fk",
    );
  });

  it("ships the same constraints in the additive migration", () => {
    const migration = readFileSync(
      resolve(
        root,
        "apps/api/drizzle/migrations/0022_organization_reference_constraints.sql",
      ),
      "utf8",
    );

    for (const name of [
      "customers_organization_id_id_unique",
      "orders_organization_id_id_unique",
      "orders_organization_id_customer_id_customers_fk",
      "invoices_organization_id_order_id_orders_fk",
      "invoices_organization_id_customer_id_customers_fk",
      "payments_organization_id_customer_id_customers_fk",
    ]) {
      expect(migration).toContain(`"${name}"`);
    }
  });
});
