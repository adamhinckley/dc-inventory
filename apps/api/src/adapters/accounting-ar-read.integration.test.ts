import {
  DrizzleInvoiceRepository,
  GetAccountingSummaryUseCase,
  InMemoryArCustomerReadPort,
  InMemoryArOrgReadPort,
  InMemoryPaymentsReceivedListQuery,
  ListCustomerBalancesQuery,
  ListPaymentsReceivedQuery,
  type AccountingDrizzle,
} from "@dc-inventory/accounting";
import { InMemoryCustomerBalancesListQuery } from "@dc-inventory/accounting";
import {
  DrizzleOpenOrderExposureReadAdapter,
  InMemoryOpenOrderExposureReadAdapter,
  InMemorySalesOrderRepository,
  SalesOrderLineId,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/db.js";
import { schema } from "../infrastructure/schema.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";
import { createCustomerBalancesListQuery } from "./accounting-customer-balances-list-query.js";
import { createArCustomerReadPort } from "./accounting-ar-customer-read.js";
import { createArOrgReadPort } from "./accounting-ar-org-read.js";
import { DrizzlePaymentsReceivedListQuery } from "./accounting-payments-received-list-query.js";
import {
  assertCustomerScopedInvoiceQuery,
  capturePostgresQuery,
  isArBalancesBusinessQuery,
  normalizeSql,
  referencesAccountingTable,
  type CapturedQuery,
} from "./drizzle-sql-capture.js";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const integrationEnabled = process.env.AR_READ_INTEGRATION === "1";

// Runs in required CI via scripts/ci-compose-migrate-ready.sh (AR_READ_INTEGRATION=1).
describe.skipIf(!integrationEnabled || !databaseUrl)(
  "PostgreSQL AR read model matches in-memory projections",
  () => {
    let connection!: DatabaseConnection;
    const organizationId = OrganizationId.parse(randomUUID());
    const organizationSlug = `ada-360-${organizationId}`;
    const customerId = CustomerId.parse(randomUUID());
    const shippedOrderId = OrderId.parse(randomUUID());
    const confirmedOrderId = OrderId.parse(randomUUID());
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
          (${shippedOrderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-SHIP-${organizationId}`}, ${"2026-08-01T00:00:00.000Z"}),
          (${confirmedOrderId}, ${organizationId}, ${customerId}, 'confirmed', ${`SO-CONF-${organizationId}`}, ${"2026-08-20T00:00:00.000Z"})
      `;
      await connection.sql`
        insert into sales.order_lines
          (id, order_id, sku, name, qty, unit_price_cents, currency)
        values
          (${randomUUID()}, ${confirmedOrderId}, 'SKU-CONF', 'Confirmed line', 2, 1250, 'USD')
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
            ${shippedOrderId},
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

    it("bulk SQL org read matches repository-backed in-memory org read", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const drizzleProfiles = new DrizzleCustomerArProfileReadPort(db);
      const inMemoryOrgRead = new InMemoryArOrgReadPort(repository, drizzleProfiles);
      const sqlOrgRead = createArOrgReadPort(db);

      const inMemoryData = await inMemoryOrgRead.loadAllCustomerData(organizationId);
      const sqlData = await sqlOrgRead.loadAllCustomerData(organizationId);
      expect(sqlData.size).toBe(inMemoryData.size);

      const inMemoryCustomer = inMemoryData.get(customerId);
      const sqlCustomer = sqlData.get(customerId);
      expect(sqlCustomer?.invoices).toHaveLength(inMemoryCustomer?.invoices.length ?? 0);
      expect(sqlCustomer?.payments).toHaveLength(inMemoryCustomer?.payments.length ?? 0);
      expect(sqlCustomer?.invoices[0]?.total.amountMinor).toBe(3000);
    });

    it("summary and list queries match between SQL bulk read and in-memory org read", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const drizzleProfiles = new DrizzleCustomerArProfileReadPort(db);
      const inMemoryOrgRead = new InMemoryArOrgReadPort(repository, drizzleProfiles);
      const sqlOrgRead = createArOrgReadPort(db);
      const salesOrders = new InMemorySalesOrderRepository();
      await salesOrders.save({
        id: confirmedOrderId,
        organizationId,
        customerId,
        documentNumber: `SO-CONF-${organizationId}`,
        status: "confirmed",
        createdAt: new Date("2026-08-20T00:00:00.000Z"),
        lines: [
          {
            id: SalesOrderLineId.parse(randomUUID()),
            sku: Sku.parse("SKU-CONF"),
            name: "Confirmed line",
            qty: 2,
            unitPrice: Money.fromMinorUnits(1250, "USD"),
          },
        ],
      });
      const inMemoryExposure = new InMemoryOpenOrderExposureReadAdapter(salesOrders);
      const sqlExposure = new DrizzleOpenOrderExposureReadAdapter(db as unknown as SalesDrizzle);

      expect(await sqlExposure.getOpenOrderExposureCents(organizationId, customerId)).toBe(2500);
      expect(typeof (await sqlExposure.getOpenOrderExposureCents(organizationId, customerId))).toBe(
        "number",
      );

      const inMemorySummary = await new GetAccountingSummaryUseCase(inMemoryOrgRead).execute({
        organizationId,
        asOf,
      });
      const sqlSummary = await new GetAccountingSummaryUseCase(sqlOrgRead).execute({
        organizationId,
        asOf,
      });
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
          inMemoryOrgRead,
          drizzleProfiles,
          inMemoryExposure,
        ),
      ).execute(listQuery);
      const sqlBalances = await new ListCustomerBalancesQuery(
        createCustomerBalancesListQuery(db),
      ).execute(listQuery);
      expect(sqlBalances).toEqual(inMemoryBalances);
      expect(sqlBalances.items[0]?.availableCreditCents).toBe(45_500);

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
        new InMemoryPaymentsReceivedListQuery(repository, drizzleProfiles),
      ).execute(paymentsQuery);
      const sqlPayments = await new ListPaymentsReceivedQuery(
        new DrizzlePaymentsReceivedListQuery(db),
      ).execute(paymentsQuery);
      expect(sqlPayments).toEqual(inMemoryPayments);
    });

    it("customer-scoped SQL read matches in-memory and does not select all org invoices", async () => {
      const otherCustomerId = CustomerId.parse(randomUUID());
      const otherInvoiceId = InvoiceId.parse(randomUUID());
      const otherOrderId = OrderId.parse(randomUUID());
      await connection.sql`
        insert into customers.customers
          (id, organization_id, name, customer_number, credit_limit_cents, currency, terms)
        values
          (${otherCustomerId}, ${organizationId}, 'Other customer', ${`CUST-OTHER-${organizationId}`}, 10000, 'USD', 'NET30')
      `;
      await connection.sql`
        insert into sales.orders
          (id, organization_id, customer_id, status, document_number, created_at)
        values
          (${otherOrderId}, ${organizationId}, ${otherCustomerId}, 'shipped', ${`SO-OTHER-${organizationId}`}, ${"2026-08-10T00:00:00.000Z"})
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
            ${otherInvoiceId},
            ${organizationId},
            ${otherOrderId},
            ${otherCustomerId},
            ${`INV-OTHER-${organizationId}`},
            'posted',
            ${"2026-08-10T00:00:00.000Z"},
            ${"2026-08-10T00:00:00.000Z"},
            9000,
            9000,
            'USD'
          )
      `;

      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const inMemoryCustomerRead = new InMemoryArCustomerReadPort(repository);
      const sqlCustomerRead = createArCustomerReadPort(db);

      const inMemoryData = await inMemoryCustomerRead.loadCustomerData(organizationId, customerId);
      const sqlData = await sqlCustomerRead.loadCustomerData(organizationId, customerId);
      expect(sqlData.invoices).toHaveLength(inMemoryData.invoices.length);
      expect(sqlData.payments).toHaveLength(inMemoryData.payments.length);
      expect(sqlData.invoices.every((invoice) => invoice.customerId === customerId)).toBe(true);
      expect(sqlData.invoices.some((invoice) => invoice.id === otherInvoiceId)).toBe(false);

      const capturedQueries: CapturedQuery[] = [];
      const tracedSql = postgres(databaseUrl, {
        max: 1,
        debug: (_connection, query, parameters) => {
          capturedQueries.push(capturePostgresQuery(query, parameters));
        },
      });
      const tracedDb = drizzle(tracedSql, { schema });
      const tracedCustomerRead = createArCustomerReadPort(tracedDb);
      await tracedCustomerRead.loadCustomerData(organizationId, customerId);
      await tracedSql.end({ timeout: 5 });

      expect(capturedQueries.length).toBeGreaterThan(0);
      const invoiceQueries = capturedQueries.filter((entry) =>
        referencesAccountingTable(entry.text, "invoices"),
      );
      expect(invoiceQueries.length).toBeGreaterThan(0);
      for (const entry of invoiceQueries) {
        assertCustomerScopedInvoiceQuery(entry, customerId);
      }
      expect(
        invoiceQueries.some((entry) => entry.parameters.map(String).includes(String(otherCustomerId))),
      ).toBe(false);
    });
  },
);

describe.skipIf(!integrationEnabled || !databaseUrl)(
  "SQL AR balances list and summary aggregates (ADA-382)",
  () => {
    let connection!: DatabaseConnection;
    const organizationId = OrganizationId.parse(randomUUID());
    const organizationSlug = `ada-382-${organizationId}`;
    const asOf = new Date("2026-09-09T00:00:00.000Z");
    const pageSize = 25;
    const seededCustomerCount = 40;

    beforeAll(async () => {
      connection = createDatabaseConnection(databaseUrl);

      await connection.sql`
        insert into identity.organizations (id, slug)
        values (${organizationId}, ${organizationSlug})
      `;

      for (let index = 0; index < seededCustomerCount; index += 1) {
        const customerId = randomUUID();
        const orderId = randomUUID();
        const invoiceId = randomUUID();
        const dueDay = String((index % 28) + 1).padStart(2, "0");
        const totalCents = 1000 + index;
        await connection.sql`
          insert into customers.customers
            (id, organization_id, name, customer_number, credit_limit_cents, currency, terms)
          values
            (
              ${customerId},
              ${organizationId},
              ${`ADA-382 customer ${index}`},
              ${`C382-${String(index).padStart(4, "0")}`},
              50000,
              'USD',
              'NET30'
            )
        `;
        await connection.sql`
          insert into sales.orders
            (id, organization_id, customer_id, status, document_number, created_at)
          values
            (${orderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-${index}`}, ${"2026-08-01T00:00:00.000Z"})
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
              ${`INV-${index}`},
              'posted',
              ${"2026-08-01T00:00:00.000Z"},
              ${`2026-08-${dueDay}T00:00:00.000Z`},
              ${totalCents},
              ${totalCents},
              'USD'
            )
        `;
      }
    });

    afterAll(async () => {
      await connection.sql.end({ timeout: 5 });
    });

    it("uses at most ten database statements for a balances page regardless of customer count", async () => {
      const capturedQueries: CapturedQuery[] = [];
      const tracedSql = postgres(databaseUrl, {
        max: 1,
        debug: (_connection, query, parameters) => {
          capturedQueries.push(capturePostgresQuery(query, parameters));
        },
      });
      const tracedDb = drizzle(tracedSql, { schema });
      const tracedBalances = createCustomerBalancesListQuery(tracedDb);

      await tracedSql`select 1`;
      capturedQueries.length = 0;

      await new ListCustomerBalancesQuery(tracedBalances).execute({
        organizationId,
        asOf,
        page: 1,
        pageSize,
        sortBy: "pastDue",
        sortOrder: "desc",
      });
      await tracedSql.end({ timeout: 5 });

      const businessQueries = capturedQueries.filter((entry) =>
        isArBalancesBusinessQuery(entry.text),
      );

      expect(businessQueries.length).toBeLessThanOrEqual(10);
      expect(businessQueries.length).toBe(2);
    });

    it("uses at most four database statements for org summary aggregates", async () => {
      const capturedQueries: CapturedQuery[] = [];
      const tracedSql = postgres(databaseUrl, {
        max: 1,
        debug: (_connection, query, parameters) => {
          capturedQueries.push(capturePostgresQuery(query, parameters));
        },
      });
      const tracedDb = drizzle(tracedSql, { schema });
      const tracedOrgRead = createArOrgReadPort(tracedDb);

      await tracedSql`select 1`;
      capturedQueries.length = 0;

      await new GetAccountingSummaryUseCase(tracedOrgRead).execute({
        organizationId,
        asOf,
      });
      await tracedSql.end({ timeout: 5 });

      const businessQueries = capturedQueries.filter((entry) =>
        isArBalancesBusinessQuery(entry.text),
      );

      expect(businessQueries.length).toBeLessThanOrEqual(4);
      expect(businessQueries.length).toBe(2);
      expect(
        businessQueries.every(
          (entry) => !/select \* from accounting\.payments\b/i.test(normalizeSql(entry.text)),
        ),
      ).toBe(true);
    });

    it("sorts balances by oldestDue without invalid ORDER BY SQL", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const drizzleProfiles = new DrizzleCustomerArProfileReadPort(db);
      const inMemoryOrgRead = new InMemoryArOrgReadPort(repository, drizzleProfiles);
      const inMemoryExposure = new InMemoryOpenOrderExposureReadAdapter(new InMemorySalesOrderRepository());
      const listQuery = {
        organizationId,
        asOf,
        page: 1,
        pageSize: 10,
        sortBy: "oldestDue" as const,
        sortOrder: "desc" as const,
      };

      const inMemoryBalances = await new ListCustomerBalancesQuery(
        new InMemoryCustomerBalancesListQuery(
          inMemoryOrgRead,
          drizzleProfiles,
          inMemoryExposure,
        ),
      ).execute(listQuery);
      const sqlBalances = await new ListCustomerBalancesQuery(
        createCustomerBalancesListQuery(db),
      ).execute(listQuery);

      expect(sqlBalances.total).toBe(inMemoryBalances.total);
      expect(sqlBalances.items.map((row) => row.customerId)).toEqual(
        inMemoryBalances.items.map((row) => row.customerId),
      );
    });

    it("ignores payment applications to invoices posted after asOf when computing unapplied credit", async () => {
      const db = connection.db;
      const repository = new DrizzleInvoiceRepository(db as unknown as AccountingDrizzle);
      const drizzleProfiles = new DrizzleCustomerArProfileReadPort(db);
      const inMemoryOrgRead = new InMemoryArOrgReadPort(repository, drizzleProfiles);
      const inMemoryExposure = new InMemoryOpenOrderExposureReadAdapter(new InMemorySalesOrderRepository());
      const customerId = CustomerId.parse(randomUUID());
      const earlyOrderId = OrderId.parse(randomUUID());
      const futureOrderId = OrderId.parse(randomUUID());
      const futureInvoiceId = InvoiceId.parse(randomUUID());
      const paymentId = randomUUID();
      const asOfMidMonth = new Date("2026-09-09T00:00:00.000Z");

      await connection.sql`
        insert into customers.customers
          (id, organization_id, name, customer_number, credit_limit_cents, currency, terms)
        values
          (${customerId}, ${organizationId}, 'As-of credit customer', ${`C382-ASOF-${customerId}`}, 50000, 'USD', 'NET30')
      `;
      await connection.sql`
        insert into sales.orders
          (id, organization_id, customer_id, status, document_number, created_at)
        values
          (${earlyOrderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-ASOF-${customerId}`}, ${"2026-08-01T00:00:00.000Z"}),
          (${futureOrderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-FUT-${customerId}`}, ${"2026-09-15T00:00:00.000Z"})
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
            ${futureInvoiceId},
            ${organizationId},
            ${futureOrderId},
            ${customerId},
            ${`INV-FUT-${customerId}`},
            'posted',
            ${"2026-09-15T00:00:00.000Z"},
            ${"2026-10-01T00:00:00.000Z"},
            500,
            500,
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
            received_at
          )
        values
          (
            ${paymentId},
            ${organizationId},
            ${customerId},
            900,
            'USD',
            ${`ada-382-asof-${paymentId}`},
            'check',
            ${"2026-09-01T00:00:00.000Z"}
          )
      `;
      await connection.sql`
        insert into accounting.payment_applications
          (id, payment_id, invoice_id, amount_cents, currency)
        values
          (${randomUUID()}, ${paymentId}, ${futureInvoiceId}, 900, 'USD')
      `;

      const listQuery = {
        organizationId,
        asOf: asOfMidMonth,
        q: "As-of credit",
        page: 1,
        pageSize: 10,
        sortBy: "openBalance" as const,
        sortOrder: "desc" as const,
      };
      const inMemoryBalances = await new ListCustomerBalancesQuery(
        new InMemoryCustomerBalancesListQuery(
          inMemoryOrgRead,
          drizzleProfiles,
          inMemoryExposure,
        ),
      ).execute(listQuery);
      const sqlBalances = await new ListCustomerBalancesQuery(
        createCustomerBalancesListQuery(db),
      ).execute(listQuery);

      expect(inMemoryBalances.items).toHaveLength(1);
      expect(inMemoryBalances.items[0]?.openBalanceCents).toBe(-900);
      expect(sqlBalances.items).toEqual(inMemoryBalances.items);
    });
  },
);
