import { customers } from "@dc-inventory/customers/schema";
import { CustomerId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/postgres-js";
import type { SalesDrizzle } from "../../src/adapters/drizzle-sales-orders.js";
import { buildCommittedCustomerNamesQuery } from "../../src/persistence/committed-customer-names-sql.js";
import { orderLines, orders } from "../../src/persistence/schema.js";

export type CommittedCustomerNamesFixtureRow = Readonly<{
  customerId: CustomerId;
  customerName: string;
  orderId: string;
  status: "draft" | "confirmed" | "shipped" | "cancelled";
  sku: string;
}>;

async function seedFixture(
  client: PGlite,
  rows: readonly CommittedCustomerNamesFixtureRow[],
): Promise<void> {
  await client.exec(`
    TRUNCATE sales.order_lines, sales.orders, customers.customers;
  `);
  for (const row of rows) {
    await client.query(
      `INSERT INTO customers.customers
        (id, organization_id, name, credit_limit_cents, currency, terms)
       VALUES ($1, $2, $3, 1000000, 'USD', 'NET30')`,
      [row.customerId, OrganizationId.DEFAULT, row.customerName],
    );
    await client.query(
      `INSERT INTO sales.orders
        (id, organization_id, customer_id, status, document_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.orderId, OrganizationId.DEFAULT, row.customerId, row.status, `SO-${row.orderId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO sales.order_lines
        (id, order_id, sku, name, qty, unit_price_cents, currency)
       VALUES ($1, $2, $3, 'Line', 5, 100, 'USD')`,
      [`11111111-1111-4111-8111-${row.orderId.slice(-12)}`, row.orderId, row.sku],
    );
  }
}

export async function createCommittedCustomerNamesSqlEvaluator() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA customers;
    CREATE SCHEMA sales;
    CREATE TABLE customers.customers (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      name text NOT NULL,
      credit_limit_cents bigint NOT NULL,
      currency char(3) NOT NULL DEFAULT 'USD',
      terms text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, id)
    );
    CREATE TYPE sales.order_status AS ENUM ('draft', 'confirmed', 'shipped', 'cancelled');
    CREATE TABLE sales.orders (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL,
      status sales.order_status NOT NULL DEFAULT 'draft',
      document_number text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, id)
    );
    CREATE TABLE sales.order_lines (
      id uuid PRIMARY KEY,
      order_id uuid NOT NULL REFERENCES sales.orders(id),
      sku text NOT NULL,
      name text NOT NULL,
      qty integer NOT NULL,
      unit_price_cents bigint NOT NULL,
      currency char(3) NOT NULL DEFAULT 'USD',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const db = drizzle.mock({
    schema: { customers, orderLines, orders },
  }) as unknown as SalesDrizzle;

  return {
    async list(
      skus: readonly Sku[],
      fixture: readonly CommittedCustomerNamesFixtureRow[],
    ): Promise<readonly { customerId: CustomerId; name: string }[]> {
      await seedFixture(client, fixture);
      const { sql, params } = buildCommittedCustomerNamesQuery(
        db,
        OrganizationId.DEFAULT,
        skus,
      ).toSQL();
      const result = await client.query<{
        customer_id: string;
        name: string;
      }>(sql, params);
      return result.rows.map((row) => ({
        customerId: CustomerId.parse(row.customer_id),
        name: row.name,
      }));
    },
    async close(): Promise<void> {
      await client.close();
    },
  };
}
