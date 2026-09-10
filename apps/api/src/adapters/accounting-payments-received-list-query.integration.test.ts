import {
  DrizzleInvoiceRepository,
  InMemoryPaymentsReceivedListQuery,
  ListPaymentsReceivedQuery,
  type AccountingDrizzle,
} from "@dc-inventory/accounting";
import { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
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
    const staffUserId = StaffUserId.parse(randomUUID());
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-09-30T00:00:00.000Z");

    beforeAll(async () => {
      connection = createDatabaseConnection(databaseUrl);

      await connection.sql`
        insert into identity.organizations (id, slug)
        values (${organizationId}, ${organizationSlug})
      `;
      await connection.sql`
        insert into customers.customers
          (id, organization_id, name, customer_number, credit_limit_cents, currency, terms)
        values
          (${customerId}, ${organizationId}, 'ADA-381 customer', ${`CUST-${organizationId}`}, 50000, 'USD', 'NET30')
      `;

      for (let index = 0; index < seededPaymentCount; index += 1) {
        const day = String((index % 28) + 1).padStart(2, "0");
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
              recorded_by
            )
          values
            (
              ${randomUUID()},
              ${organizationId},
              ${customerId},
              ${100 + index},
              'USD',
              ${`ada-381-payment-${organizationId}-${index}`},
              'check',
              ${`REF-${index}`},
              ${`2026-08-${day}T12:00:00.000Z`},
              ${staffUserId}
            )
        `;
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

      expect(capturedQueries.length).toBeGreaterThan(0);
      expect(capturedQueries.length).toBeLessThanOrEqual(3);
      expect(
        capturedQueries.some((entry) => referencesAccountingTable(entry.text, "payments")),
      ).toBe(true);
    });
  },
);
