import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const acceptanceEnabled =
  process.env.RUN_ORGANIZATION_CONSTRAINT_ACCEPTANCE === "1" &&
  databaseUrl.length > 0;

const sql = acceptanceEnabled ? postgres(databaseUrl, { max: 1 }) : null;
const organizationA = randomUUID();
const organizationB = randomUUID();
const customerA = randomUUID();
const customerB = randomUUID();
const orderA = randomUUID();
const invoiceA = randomUUID();
const paymentA = randomUUID();

async function expectForeignKeyViolation(work: () => Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await work();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ code: "23503" });
}

describe.skipIf(!acceptanceEnabled)(
  "organization-scoped database references",
  () => {
    beforeAll(async () => {
      await sql!`
        INSERT INTO customers.customers
          (id, organization_id, name, credit_limit_cents, currency, terms)
        VALUES
          (${customerA}, ${organizationA}, 'Constraint customer A', 0, 'USD', 'Net 30'),
          (${customerB}, ${organizationB}, 'Constraint customer B', 0, 'USD', 'Net 30')
      `;
    });

    afterAll(async () => {
      await sql!`DELETE FROM accounting.payments WHERE id = ${paymentA}`;
      await sql!`DELETE FROM accounting.invoices WHERE id = ${invoiceA}`;
      await sql!`DELETE FROM sales.orders WHERE id = ${orderA}`;
      await sql!`
        DELETE FROM customers.customers
        WHERE id IN (${customerA}, ${customerB})
      `;
      await sql!.end();
    });

    it("rejects cross-organization customer, order, invoice, and payment references", async () => {
      await expectForeignKeyViolation(
        async () =>
          sql!`
            INSERT INTO sales.orders
              (id, organization_id, customer_id, status, document_number)
            VALUES
              (${orderA}, ${organizationB}, ${customerA}, 'draft', ${`SO-${orderA}`})
          `,
      );

      await sql!`
        INSERT INTO sales.orders
          (id, organization_id, customer_id, status, document_number)
        VALUES
          (${orderA}, ${organizationA}, ${customerA}, 'draft', ${`SO-${orderA}`})
      `;

      await expectForeignKeyViolation(
        async () =>
          sql!`
            INSERT INTO accounting.invoices
              (id, organization_id, order_id, customer_id, document_number, status,
               subtotal_cents, tax_total_cents, total_cents, currency)
            VALUES
              (${invoiceA}, ${organizationB}, ${orderA}, ${customerB}, ${`INV-${invoiceA}`},
               'unposted', 100, 0, 100, 'USD')
          `,
      );

      await expectForeignKeyViolation(
        async () =>
          sql!`
            INSERT INTO accounting.invoices
              (id, organization_id, order_id, customer_id, document_number, status,
               subtotal_cents, tax_total_cents, total_cents, currency)
            VALUES
              (${invoiceA}, ${organizationA}, ${orderA}, ${customerB}, ${`INV-${invoiceA}`},
               'unposted', 100, 0, 100, 'USD')
          `,
      );

      await expectForeignKeyViolation(
        async () =>
          sql!`
            INSERT INTO accounting.payments
              (id, organization_id, customer_id, amount_cents, currency, idempotency_key)
            VALUES
              (${paymentA}, ${organizationB}, ${customerA}, 100, 'USD', ${`PAY-${paymentA}`})
          `,
      );

      await sql!`
        INSERT INTO accounting.invoices
          (id, organization_id, order_id, customer_id, document_number, status,
           subtotal_cents, tax_total_cents, total_cents, currency)
        VALUES
          (${invoiceA}, ${organizationA}, ${orderA}, ${customerA}, ${`INV-${invoiceA}`},
           'unposted', 100, 0, 100, 'USD')
      `;
      await sql!`
        INSERT INTO accounting.payments
          (id, organization_id, customer_id, amount_cents, currency, idempotency_key)
        VALUES
          (${paymentA}, ${organizationA}, ${customerA}, 100, 'USD', ${`PAY-${paymentA}`})
      `;
    });
  },
);
