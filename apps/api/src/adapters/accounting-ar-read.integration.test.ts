import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  GetAccountingSummaryUseCase,
  InMemoryArCustomerReadPort,
  InMemoryCustomerBalancesListQuery,
  InMemoryPaymentsReceivedListQuery,
  ListCustomerBalancesQuery,
  ListPaymentsReceivedQuery,
} from "@dc-inventory/accounting";
import {
  DrizzleOpenOrderExposureReadAdapter,
  InMemoryOpenOrderExposureReadAdapter,
  InMemorySalesOrderRepository,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/db.js";
import { createArCustomerReadPort } from "./accounting-ar-customer-read.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";
import { createCustomerBalancesListQuery } from "./accounting-customer-balances-list-query.js";
import { DrizzlePaymentsReceivedListQuery } from "./accounting-payments-received-list-query.js";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const integrationEnabled = process.env.AR_READ_INTEGRATION === "1";

describe.skipIf(!integrationEnabled || !databaseUrl)(
  "PostgreSQL AR read model matches in-memory projections",
  () => {
    let connection!: DatabaseConnection;
    const organizationId = OrganizationId.parse(randomUUID());
    const organizationSlug = `ada-360-${organizationId}`;
    const customerId = CustomerId.parse(randomUUID());
    const orderId = OrderId.parse(randomUUID());
    const invoiceId = InvoiceId.parse(randomUUID());
    const staffUserId = StaffUserId.parse(randomUUID());
    const asOf = new Date("2026-09-09T00:00:00.000Z");

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
          (${customerId}, ${organizationId}, 'ADA-360 customer', ${`CUST-${organizationId}`}, 50000, 'USD', 'NET30')
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
            ${"2026-08-15T00:00:00.000Z"},
            ${"2026-08-01T00:00:00.000Z"},
            3000,
            3000,
            'USD'
          )
      `;
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
            1000,
            'USD',
            ${`ada-360-payment-${organizationId}`},
            'check',
            '1234',
            ${"2026-08-20T00:00:00.000Z"},
            ${staffUserId}
          )
      `;
      const [paymentRow] = await connection.sql<{ id: string }[]>`
        select id from accounting.payments
        where organization_id = ${organizationId}
        limit 1
      `;
      await connection.sql`
        insert into accounting.payment_applications
          (id, payment_id, invoice_id, amount_cents, currency)
        values
          (
            ${randomUUID()},
            ${paymentRow.id},
            ${invoiceId},
            1000,
            'USD'
          )
      `;
    });

    afterAll(async () => {
      await connection.sql.end({ timeout: 5 });
    });

    it("summary and list queries match in-memory adapters on seeded data", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const inMemoryRepository = new InMemoryArCustomerReadPort(repository);
      const customerProfiles = new DrizzleCustomerArProfileReadPort(db);
      const salesOrders = new InMemorySalesOrderRepository();
      const inMemoryExposure = new InMemoryOpenOrderExposureReadAdapter(salesOrders);
      const sqlExposure = new DrizzleOpenOrderExposureReadAdapter(db as unknown as SalesDrizzle);

      const inMemorySummary = await new GetAccountingSummaryUseCase(
        inMemoryRepository,
        customerProfiles,
        inMemoryExposure,
      ).execute({ organizationId, asOf });
      const sqlSummary = await new GetAccountingSummaryUseCase(
        createArCustomerReadPort(db),
        customerProfiles,
        sqlExposure,
      ).execute({ organizationId, asOf });

      expect(sqlSummary).toEqual(inMemorySummary);

      const listQuery = {
        organizationId,
        asOf,
        page: 1,
        pageSize: 20,
        sortBy: "pastDue" as const,
        sortOrder: "desc" as const,
      };
      const inMemoryBalances = await new ListCustomerBalancesQuery(
        new InMemoryCustomerBalancesListQuery(
          inMemoryRepository,
          customerProfiles,
          inMemoryExposure,
        ),
      ).execute(listQuery);
      const sqlBalances = await new ListCustomerBalancesQuery(
        createCustomerBalancesListQuery(db),
      ).execute(listQuery);
      expect(sqlBalances).toEqual(inMemoryBalances);

      const paymentsQuery = {
        organizationId,
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-09-30T00:00:00.000Z"),
        page: 1,
        pageSize: 20,
        sortBy: "receivedAt" as const,
        sortOrder: "desc" as const,
      };
      const inMemoryPayments = await new ListPaymentsReceivedQuery(
        new InMemoryPaymentsReceivedListQuery(repository, customerProfiles),
      ).execute(paymentsQuery);
      const sqlPayments = await new ListPaymentsReceivedQuery(
        new DrizzlePaymentsReceivedListQuery(db),
      ).execute(paymentsQuery);
      expect(sqlPayments).toEqual(inMemoryPayments);
    });
  },
);
