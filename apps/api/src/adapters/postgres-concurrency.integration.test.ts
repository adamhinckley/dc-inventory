import { randomUUID } from "node:crypto";
import {
  InvoiceId,
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { RecordPaymentUseCase } from "@dc-inventory/accounting";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAccountingUnitOfWork } from "./postgres-accounting-unit-of-work.js";
import { PostgresInventoryUnitOfWork } from "./postgres-inventory-unit-of-work.js";
import {
  createDatabaseConnection,
  type DatabaseConnection,
  type SqlClient,
} from "../infrastructure/db.js";

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const TEST_INSTANT = new Date("2026-08-29T00:00:00.000Z");

describeWithPostgres("Postgres concurrency control", () => {
  let first: DatabaseConnection;
  let second: DatabaseConnection;
  const organizations = new Set<string>();

  beforeAll(() => {
    first = createDatabaseConnection(databaseUrl);
    second = createDatabaseConnection(databaseUrl);
  });

  afterAll(async () => {
    for (const organizationId of organizations) {
      await cleanupOrganization(first.sql, organizationId);
    }
    await Promise.all([
      first.sql.end({ timeout: 5 }),
      second.sql.end({ timeout: 5 }),
    ]);
  });

  it("does not lose concurrent stock updates from two connections", async () => {
    const organizationId = newOrganizationId();
    const sku = Sku.parse("ADA-197-STOCK");
    await insertDefaultLocation(first.sql, organizationId);

    const firstUow = inventoryUnitOfWork(first);
    const secondUow = inventoryUnitOfWork(second);
    const [left, right] = await Promise.all([
      recordAdjustment(firstUow, organizationId, sku, "stock-left"),
      recordAdjustment(secondUow, organizationId, sku, "stock-right"),
    ]);

    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    const [snapshot] = await first.sql<{
      on_hand: number;
      movement_count: number;
    }[]>`
      select
        snapshot.on_hand,
        (
          select count(*)::int
          from inventory.stock_movements movement
          where movement.organization_id = ${organizationId}
            and movement.sku = ${sku.value}
        ) as movement_count
      from inventory.stock_snapshots snapshot
      where snapshot.organization_id = ${organizationId}
        and snapshot.sku = ${sku.value}
    `;
    expect(snapshot).toEqual({ on_hand: 2, movement_count: 2 });
  });

  it("rejects concurrent applications that would overpay an invoice", async () => {
    const fixture = await insertInvoiceFixture(first.sql, newOrganizationId(), 1_000);
    const firstPayment = new RecordPaymentUseCase(
      new PostgresAccountingUnitOfWork(first.db),
    );
    const secondPayment = new RecordPaymentUseCase(
      new PostgresAccountingUnitOfWork(second.db),
    );

    const results = await Promise.all([
      firstPayment.execute({
        staffUserId: STAFF_ID,
        organizationId: fixture.organizationId,
        invoiceId: fixture.invoiceId,
        amountCents: 700,
        currency: "USD",
        idempotencyKey: "payment-left",
      }),
      secondPayment.execute({
        staffUserId: STAFF_ID,
        organizationId: fixture.organizationId,
        invoiceId: fixture.invoiceId,
        amountCents: 700,
        currency: "USD",
        idempotencyKey: "payment-right",
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "overpay" },
    ]);
    const [application] = await first.sql<{ applied_cents: number }[]>`
      select coalesce(sum(amount_cents), 0)::int as applied_cents
      from accounting.payment_applications
      where invoice_id = ${fixture.invoiceId}
    `;
    expect(application?.applied_cents).toBe(700);
  });

  it("does not block writes to unrelated organizations or SKUs", async () => {
    const lockedOrganizationId = newOrganizationId();
    const otherOrganizationId = newOrganizationId();
    const lockedSku = Sku.parse("ADA-197-LOCKED");
    const otherSku = Sku.parse("ADA-197-OTHER");
    const lockedLocationId = await insertDefaultLocation(
      first.sql,
      lockedOrganizationId,
    );
    await insertDefaultLocation(first.sql, otherOrganizationId);
    await insertSnapshot(
      first.sql,
      lockedOrganizationId,
      lockedSku.value,
      lockedLocationId,
    );

    let releaseLock = () => {};
    let reportLocked = () => {};
    const released = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      reportLocked = resolve;
    });
    const holdingTransaction = first.sql.begin(async (transaction) => {
      await transaction`
        select id
        from inventory.stock_snapshots
        where organization_id = ${lockedOrganizationId}
          and sku = ${lockedSku.value}
          and location_id = ${lockedLocationId}
        for update
      `;
      reportLocked();
      await released;
    });
    await locked;

    try {
      const uow = inventoryUnitOfWork(second);
      const writes = Promise.all([
        recordAdjustment(uow, lockedOrganizationId, otherSku, "other-sku"),
        recordAdjustment(uow, otherOrganizationId, lockedSku, "other-org"),
      ]);
      const results = await Promise.race([
        writes,
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("unrelated inventory writes were blocked")),
            2_000,
          );
        }),
      ]);
      expect(results.every((result) => result.ok)).toBe(true);
    } finally {
      releaseLock();
      await holdingTransaction;
    }
  });

  function newOrganizationId(): OrganizationId {
    const organizationId = OrganizationId.parse(randomUUID());
    organizations.add(organizationId);
    return organizationId;
  }
});

function inventoryUnitOfWork(connection: DatabaseConnection) {
  return new PostgresInventoryUnitOfWork(connection.db, {
    now: () => new Date(TEST_INSTANT),
  });
}

function recordAdjustment(
  unitOfWork: PostgresInventoryUnitOfWork,
  organizationId: OrganizationId,
  sku: Sku,
  idempotencyKey: string,
) {
  return unitOfWork.run((scope) =>
    scope.inventory.ledger.recordAdjustmentIncrease({
      organizationId,
      sku,
      quantity: 1,
      idempotencyKey,
      refType: "adjustment",
      refId: randomUUID(),
    }),
  );
}

async function insertDefaultLocation(
  sql: SqlClient,
  organizationId: OrganizationId,
): Promise<string> {
  const locationId = randomUUID();
  await sql`
    insert into inventory.locations (id, organization_id, code)
    values (${locationId}, ${organizationId}, 'DEFAULT')
  `;
  return locationId;
}

async function insertSnapshot(
  sql: SqlClient,
  organizationId: OrganizationId,
  sku: string,
  locationId: string,
): Promise<void> {
  await sql`
    insert into inventory.stock_snapshots
      (organization_id, sku, location_id)
    values (${organizationId}, ${sku}, ${locationId})
  `;
}

async function insertInvoiceFixture(
  sql: SqlClient,
  organizationId: OrganizationId,
  totalCents: number,
): Promise<{ organizationId: OrganizationId; invoiceId: InvoiceId }> {
  const customerId = randomUUID();
  const orderId = randomUUID();
  const invoiceId = InvoiceId.parse(randomUUID());
  await sql`
    insert into customers.customers
      (id, organization_id, name, credit_limit_cents, currency, terms)
    values (${customerId}, ${organizationId}, 'ADA-197 customer', 100000, 'USD', 'Net 30')
  `;
  await sql`
    insert into sales.orders
      (id, organization_id, customer_id, status, document_number)
    values (${orderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-${randomUUID()}`})
  `;
  await sql`
    insert into accounting.invoices
      (
        id,
        organization_id,
        order_id,
        customer_id,
        document_number,
        status,
        posted_at,
        subtotal_cents,
        tax_total_cents,
        total_cents,
        currency
      )
    values (
      ${invoiceId},
      ${organizationId},
      ${orderId},
      ${customerId},
      ${`INV-${randomUUID()}`},
      'posted',
      ${TEST_INSTANT},
      ${totalCents},
      0,
      ${totalCents},
      'USD'
    )
  `;
  return { organizationId, invoiceId };
}

async function cleanupOrganization(
  sql: SqlClient,
  organizationId: string,
): Promise<void> {
  await sql`
    delete from accounting.payment_applications
    where payment_id in (
      select id from accounting.payments where organization_id = ${organizationId}
    )
  `;
  await sql`delete from accounting.payments where organization_id = ${organizationId}`;
  await sql`delete from accounting.invoices where organization_id = ${organizationId}`;
  await sql`delete from sales.orders where organization_id = ${organizationId}`;
  await sql`delete from customers.customers where organization_id = ${organizationId}`;
  await sql`delete from inventory.stock_movements where organization_id = ${organizationId}`;
  await sql`delete from inventory.stock_snapshots where organization_id = ${organizationId}`;
  await sql`delete from inventory.locations where organization_id = ${organizationId}`;
}
