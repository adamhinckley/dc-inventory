import {
  DrizzleInvoiceRepository,
  InMemoryPaymentsReceivedListQuery,
  ListPaymentsReceivedQuery,
  type AccountingDrizzle,
} from "@dc-inventory/accounting";
import {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/db.js";
import { schema } from "../infrastructure/schema.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";
import { DrizzlePaymentsReceivedListQuery } from "./accounting-payments-received-list-query.js";
import {
  capturePostgresQuery,
  referencesAccountingTable,
  type CapturedQuery,
} from "./drizzle-sql-capture.js";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const integrationEnabled = process.env.AR_READ_INTEGRATION === "1";
const pageSize = 25;
const seededPaymentCount = 30;

describe.skipIf(!integrationEnabled || !databaseUrl)(
  "DrizzlePaymentsReceivedListQuery SQL pagination (ADA-381)",
  () => {
    let connection!: DatabaseConnection;
    const organizationId = OrganizationId.parse(randomUUID());
    const organizationSlug = `ada-381-${organizationId}`;
    const customerId = CustomerId.parse(randomUUID());
    const invoiceId = InvoiceId.parse(randomUUID());
    const orderId = OrderId.parse(randomUUID());
    const staffUserId = StaffUserId.parse(randomUUID());
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-09-30T00:00:00.000Z");
    let fullyAppliedPaymentId = "";
    let partiallyAppliedPaymentId = "";
    let voidedPaymentId = "";

    beforeAll(async () => {
      connection = createDatabaseConnection(databaseUrl);

      await connection.sql`
        insert into identity.organizations (id, slug, name)
        values (${organizationId}, ${organizationSlug}, 'Integration Test Org')
      `;
      await connection.sql`
        insert into customers.customers
          (id, organization_id, name, customer_number, credit_limit_cents, currency, terms)
        values
          (${customerId}, ${organizationId}, 'ADA-381 customer', ${`CUST-${organizationId}`}, 50000, 'USD', 'NET30')
      `;
      await connection.sql`
        insert into sales.orders
          (id, organization_id, customer_id, status, document_number, created_at)
        values
          (${orderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-${organizationId}`}, ${"2026-08-01T00:00:00.000Z"})
      `;
      await connection.sql`
        insert into accounting.invoices
          (
            id,
            organization_id,
            order_id,
            customer_id,
            document_number,
            status,
            posted_at,
            due_date,
            subtotal_cents,
            total_cents,
            currency
          )
        values
          (
            ${invoiceId},
            ${organizationId},
            ${orderId},
            ${customerId},
            ${`INV-${organizationId}`},
            'posted',
            ${"2026-08-01T00:00:00.000Z"},
            ${"2026-08-15T00:00:00.000Z"},
            100000,
            100000,
            'USD'
          )
      `;

      for (let index = 0; index < seededPaymentCount; index += 1) {
        const paymentId = randomUUID();
        const day = String((index % 28) + 1).padStart(2, "0");
        const amountCents = 100 + index;
        await connection.sql`
          insert into accounting.payments
            (
              id,
              organization_id,
              customer_id,
              amount_cents,
              currency,
              idempotency_key,
              method,
              reference,
              received_at,
              recorded_by,
              voided_at,
              void_reason
            )
          values
            (
              ${paymentId},
              ${organizationId},
              ${customerId},
              ${amountCents},
              'USD',
              ${`ada-381-payment-${organizationId}-${index}`},
              'check',
              ${`REF-${index}`},
              ${`2026-08-${day}T12:00:00.000Z`},
              ${staffUserId},
              ${index === 2 ? "2026-08-03T00:00:00.000Z" : null},
              ${index === 2 ? "entered in error" : null}
            )
        `;

        if (index === 0) {
          fullyAppliedPaymentId = paymentId;
          await connection.sql`
            insert into accounting.payment_applications
              (id, payment_id, invoice_id, amount_cents, currency)
            values
              (${randomUUID()}, ${paymentId}, ${invoiceId}, ${amountCents}, 'USD')
          `;
        } else if (index === 1) {
          partiallyAppliedPaymentId = paymentId;
          await connection.sql`
            insert into accounting.payment_applications
              (id, payment_id, invoice_id, amount_cents, currency)
            values
              (${randomUUID()}, ${paymentId}, ${invoiceId}, ${50}, 'USD')
          `;
        } else if (index === 2) {
          voidedPaymentId = paymentId;
          await connection.sql`
            insert into accounting.payment_applications
              (id, payment_id, invoice_id, amount_cents, currency)
            values
              (${randomUUID()}, ${paymentId}, ${invoiceId}, ${amountCents}, 'USD')
          `;
        }
      }
    });

    afterAll(async () => {
      await connection.sql.end({ timeout: 5 });
    });

    it("returns one SQL page without loading every org payment", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const drizzleProfiles = new DrizzleCustomerArProfileReadPort(db);
      const inMemoryPayments = await new ListPaymentsReceivedQuery(
        new InMemoryPaymentsReceivedListQuery(repository, drizzleProfiles),
      ).execute({
        organizationId,
        from,
        to,
        page: 1,
        pageSize,
        sortBy: "receivedAt",
        sortOrder: "desc",
      });
      const sqlPayments = await new ListPaymentsReceivedQuery(
        new DrizzlePaymentsReceivedListQuery(db),
      ).execute({
        organizationId,
        from,
        to,
        page: 1,
        pageSize,
        sortBy: "receivedAt",
        sortOrder: "desc",
      });

      expect(inMemoryPayments.total).toBe(seededPaymentCount);
      expect(sqlPayments.total).toBe(seededPaymentCount);
      expect(sqlPayments.items).toHaveLength(pageSize);
      expect(sqlPayments.items.map((row) => row.paymentId)).toEqual(
        inMemoryPayments.items.map((row) => row.paymentId),
      );
    });

    it("aggregates applied and unapplied cents for the page only", async () => {
      const sqlPayments = await new ListPaymentsReceivedQuery(
        new DrizzlePaymentsReceivedListQuery(connection.db),
      ).execute({
        organizationId,
        from,
        to,
        page: 1,
        pageSize: seededPaymentCount,
        sortBy: "receivedAt",
        sortOrder: "asc",
      });

      const fullyApplied = sqlPayments.items.find(
        (row) => row.paymentId === fullyAppliedPaymentId,
      );
      const partiallyApplied = sqlPayments.items.find(
        (row) => row.paymentId === partiallyAppliedPaymentId,
      );
      const voided = sqlPayments.items.find((row) => row.paymentId === voidedPaymentId);
      const unappliedOnly = sqlPayments.items.find((row) => row.amountCents === 100 + 3);

      expect(fullyApplied?.appliedCents).toBe(100);
      expect(fullyApplied?.unappliedCents).toBe(0);
      expect(partiallyApplied?.appliedCents).toBe(50);
      expect(partiallyApplied?.unappliedCents).toBe(51);
      expect(voided?.appliedCents).toBe(102);
      expect(voided?.unappliedCents).toBe(0);
      expect(voided?.voided).toBe(true);
      expect(unappliedOnly?.appliedCents).toBe(0);
      expect(unappliedOnly?.unappliedCents).toBe(103);
    });

    it("uses at most three database statements for a page", async () => {
      const capturedQueries: CapturedQuery[] = [];
      const tracedSql = postgres(databaseUrl, {
        max: 1,
        debug: (_connection, query, parameters) => {
          capturedQueries.push(capturePostgresQuery(query, parameters));
        },
      });
      const tracedDb = drizzle(tracedSql, { schema });
      const tracedQuery = new DrizzlePaymentsReceivedListQuery(tracedDb);

      await tracedSql`select 1`;
      capturedQueries.length = 0;

      await tracedQuery.list({
        organizationId,
        from,
        to,
        page: 1,
        pageSize,
        sortBy: "receivedAt",
        sortOrder: "desc",
      });
      await tracedSql.end({ timeout: 5 });

      const businessQueries = capturedQueries.filter(
        (entry) =>
          referencesAccountingTable(entry.text, "payments") ||
          /payment_applications/i.test(entry.text),
      );

      expect(businessQueries.length).toBe(2);
      expect(businessQueries.length).toBeLessThanOrEqual(3);
      expect(
        businessQueries.some((entry) => referencesAccountingTable(entry.text, "payments")),
      ).toBe(true);
      expect(
        businessQueries.some((entry) => /payment_applications/i.test(entry.text)),
      ).toBe(true);
    });
  },
);
