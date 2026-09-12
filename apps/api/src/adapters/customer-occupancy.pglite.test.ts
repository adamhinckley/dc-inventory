import { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { schema } from "../infrastructure/schema.js";
import type { AppDrizzle } from "../infrastructure/db.js";
import { DrizzleCustomerOccupancyReadPort } from "./drizzle-customer-occupancy-read-port.js";

const ORG = OrganizationId.DEFAULT;
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440010");

async function createOccupancyHarness() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA sales;
    CREATE SCHEMA accounting;

    CREATE TABLE sales.orders (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL,
      status text NOT NULL,
      document_number text NOT NULL
    );

    CREATE TABLE accounting.invoices (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL
    );

    CREATE TABLE accounting.payments (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL
    );

    CREATE TABLE accounting.payment_plans (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL
    );
  `);
  const db = drizzle(client, { schema }) as unknown as AppDrizzle;
  return { client, occupancy: new DrizzleCustomerOccupancyReadPort(db) };
}

describe("customer occupancy (PGlite)", () => {
  it("casts customer_id uuid binds and treats orders and AR as occupancy", async () => {
    const { client, occupancy } = await createOccupancyHarness();

    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(false);

    await client.exec(`
      INSERT INTO sales.orders (id, organization_id, customer_id, status, document_number)
      VALUES ('550e8400-e29b-41d4-a716-446655440011', '${ORG}', '${CUSTOMER_ID}', 'draft', 'SO-1');
    `);
    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(true);

    await client.exec(`DELETE FROM sales.orders;`);
    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(false);

    await client.exec(`
      INSERT INTO accounting.invoices (id, organization_id, customer_id)
      VALUES ('550e8400-e29b-41d4-a716-446655440012', '${ORG}', '${CUSTOMER_ID}');
    `);
    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(true);

    await client.exec(`DELETE FROM accounting.invoices;`);
    await client.exec(`
      INSERT INTO accounting.payments (id, organization_id, customer_id)
      VALUES ('550e8400-e29b-41d4-a716-446655440013', '${ORG}', '${CUSTOMER_ID}');
    `);
    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(true);

    await client.exec(`DELETE FROM accounting.payments;`);
    await client.exec(`
      INSERT INTO accounting.payment_plans (id, organization_id, customer_id)
      VALUES ('550e8400-e29b-41d4-a716-446655440014', '${ORG}', '${CUSTOMER_ID}');
    `);
    expect(await occupancy.hasOccupancy(ORG, CUSTOMER_ID)).toBe(true);
  });
});
