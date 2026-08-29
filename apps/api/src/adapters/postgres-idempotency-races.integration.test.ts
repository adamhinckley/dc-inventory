import {
  RecordAdjustmentIncreaseUseCase,
  RecordInboundFromPoUseCase,
  type IClock,
} from "@dc-inventory/inventory";
import { RecordPaymentUseCase } from "@dc-inventory/accounting";
import {
  CustomerId,
  InvoiceId,
  OrderId,
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/db.js";
import { PostgresAccountingUnitOfWork } from "./postgres-accounting-unit-of-work.js";
import { PostgresInventoryUnitOfWork } from "./postgres-inventory-unit-of-work.js";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const integrationEnabled = process.env.IDEMPOTENCY_RACE_INTEGRATION === "1";

const clock: IClock = {
  now: () => new Date("2026-08-29T00:00:00.000Z"),
};

describe.skipIf(!integrationEnabled || !databaseUrl)(
  "PostgreSQL idempotency races with two connections",
  () => {
    let first!: DatabaseConnection;
    let second!: DatabaseConnection;
    const organizationId = OrganizationId.parse(randomUUID());
    const organizationSlug = `ada-200-${organizationId}`;
    const customerId = CustomerId.parse(randomUUID());
    const orderId = OrderId.parse(randomUUID());
    const invoiceId = InvoiceId.parse(randomUUID());
    const staffUserId = StaffUserId.parse(randomUUID());

    beforeAll(async () => {
      first = createDatabaseConnection(databaseUrl);
      second = createDatabaseConnection(databaseUrl);

      await first.sql`
        insert into identity.organizations (id, slug)
        values (${organizationId}, ${organizationSlug})
      `;
      await first.sql`
        insert into inventory.locations (organization_id, code, is_pick_bin)
        values (${organizationId}, 'DEFAULT', false)
      `;
      await first.sql`
        insert into customers.customers
          (id, organization_id, name, credit_limit_cents, currency, terms)
        values
          (${customerId}, ${organizationId}, 'ADA-200 customer', 100000, 'USD', 'NET30')
      `;
      await first.sql`
        insert into sales.orders
          (id, organization_id, customer_id, status, document_number)
        values
          (${orderId}, ${organizationId}, ${customerId}, 'shipped', ${`SO-${organizationId}`})
      `;
      await first.sql`
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
        values
          (
            ${invoiceId},
            ${organizationId},
            ${orderId},
            ${customerId},
            ${`INV-${organizationId}`},
            'posted',
            ${clock.now()},
            1000,
            0,
            1000,
            'USD'
          )
      `;

      await first.sql.unsafe(`
        create or replace function inventory.ada_200_inventory_race_barrier()
        returns trigger
        language plpgsql
        as $$
        begin
          if new.idempotency_key like 'ada-200-%' then
            perform pg_advisory_xact_lock(hashtext(new.ref_id::text));
            perform pg_sleep(0.2);
          end if;
          return new;
        end
        $$
      `);
      await first.sql.unsafe(`
        create trigger ada_200_inventory_race_barrier
        before insert on inventory.stock_movements
        for each row execute function inventory.ada_200_inventory_race_barrier()
      `);
      await first.sql.unsafe(`
        create or replace function accounting.ada_200_payment_race_barrier()
        returns trigger
        language plpgsql
        as $$
        begin
          if new.idempotency_key like 'ada-200-%' then
            perform pg_advisory_xact_lock(hashtext(new.idempotency_key));
            perform pg_sleep(0.2);
          end if;
          return new;
        end
        $$
      `);
      await first.sql.unsafe(`
        create trigger ada_200_payment_race_barrier
        before insert on accounting.payments
        for each row execute function accounting.ada_200_payment_race_barrier()
      `);
    });

    afterAll(async () => {
      if (first === undefined || second === undefined) {
        return;
      }
      await first.sql.unsafe(
        "drop trigger if exists ada_200_inventory_race_barrier on inventory.stock_movements",
      );
      await first.sql.unsafe(
        "drop function if exists inventory.ada_200_inventory_race_barrier()",
      );
      await first.sql.unsafe(
        "drop trigger if exists ada_200_payment_race_barrier on accounting.payments",
      );
      await first.sql.unsafe(
        "drop function if exists accounting.ada_200_payment_race_barrier()",
      );
      await first.sql`delete from accounting.payment_applications where invoice_id = ${invoiceId}`;
      await first.sql`delete from accounting.payments where organization_id = ${organizationId}`;
      await first.sql`delete from accounting.invoices where organization_id = ${organizationId}`;
      await first.sql`delete from sales.orders where organization_id = ${organizationId}`;
      await first.sql`delete from customers.customers where organization_id = ${organizationId}`;
      await first.sql`delete from inventory.stock_snapshots where organization_id = ${organizationId}`;
      await first.sql`delete from inventory.stock_movements where organization_id = ${organizationId}`;
      await first.sql`delete from inventory.locations where organization_id = ${organizationId}`;
      await first.sql`delete from identity.organizations where id = ${organizationId}`;
      await Promise.all([
        first.sql.end({ timeout: 5 }),
        second.sql.end({ timeout: 5 }),
      ]);
    });

    it("replays an inventory retry and maps a provenance race to conflict", async () => {
      const firstUnitOfWork = new PostgresInventoryUnitOfWork(first.db, clock);
      const secondUnitOfWork = new PostgresInventoryUnitOfWork(second.db, clock);
      const sku = Sku.parse(`ADA-200-${randomUUID()}`);
      const refId = randomUUID();
      const command = {
        organizationId,
        idempotencyKey: `ada-200-inventory-${randomUUID()}`,
        sku,
        quantity: 7,
        refType: "adjustment" as const,
        refId,
      };

      const [firstResult, secondResult] = await Promise.all([
        firstUnitOfWork.run((scope) =>
          new RecordAdjustmentIncreaseUseCase(scope.inventory.ledger).execute(command),
        ),
        secondUnitOfWork.run((scope) =>
          new RecordAdjustmentIncreaseUseCase(scope.inventory.ledger).execute(command),
        ),
      ]);

      expect(firstResult.ok).toBe(true);
      expect(secondResult.ok).toBe(true);
      if (firstResult.ok && secondResult.ok) {
        expect(firstResult.movement.id).toBe(secondResult.movement.id);
      }
      const movementRows = await first.sql`
        select id
        from inventory.stock_movements
        where organization_id = ${organizationId}
          and idempotency_key = ${command.idempotencyKey}
      `;
      expect(movementRows).toHaveLength(1);

      const provenanceSku = Sku.parse(`ADA-200-${randomUUID()}`);
      const provenanceRefId = randomUUID();
      const provenanceResults = await Promise.all([
        firstUnitOfWork.run((scope) =>
          new RecordInboundFromPoUseCase(scope.inventory.ledger).execute({
            organizationId,
            idempotencyKey: `ada-200-provenance-a-${randomUUID()}`,
            sku: provenanceSku,
            quantity: 5,
            refType: "purchase_order",
            refId: provenanceRefId,
          }),
        ),
        secondUnitOfWork.run((scope) =>
          new RecordInboundFromPoUseCase(scope.inventory.ledger).execute({
            organizationId,
            idempotencyKey: `ada-200-provenance-b-${randomUUID()}`,
            sku: provenanceSku,
            quantity: 5,
            refType: "purchase_order",
            refId: provenanceRefId,
          }),
        ),
      ]);

      expect(provenanceResults.filter((result) => result.ok)).toHaveLength(1);
      expect(provenanceResults.filter((result) => !result.ok)).toEqual([
        { ok: false, reason: "provenance_conflict" },
      ]);
    });

    it("replays a payment retry and maps a competing payload to conflict", async () => {
      const firstUseCase = new RecordPaymentUseCase(
        new PostgresAccountingUnitOfWork(first.db),
        clock,
      );
      const secondUseCase = new RecordPaymentUseCase(
        new PostgresAccountingUnitOfWork(second.db),
        clock,
      );
      const idempotencyKey = `ada-200-payment-${randomUUID()}`;
      const request = {
        organizationId,
        staffUserId,
        invoiceId,
        amountCents: 200,
        currency: "USD",
        idempotencyKey,
      };

      const replayResults = await Promise.all([
        firstUseCase.execute(request),
        secondUseCase.execute(request),
      ]);
      expect(replayResults).toEqual([
        { ok: true, remainingCents: 800 },
        { ok: true, remainingCents: 800 },
      ]);
      const paymentRows = await first.sql`
        select id
        from accounting.payments
        where organization_id = ${organizationId}
          and idempotency_key = ${idempotencyKey}
      `;
      expect(paymentRows).toHaveLength(1);

      const conflictKey = `ada-200-payment-conflict-${randomUUID()}`;
      const conflictResults = await Promise.all([
        firstUseCase.execute({ ...request, amountCents: 100, idempotencyKey: conflictKey }),
        secondUseCase.execute({ ...request, amountCents: 150, idempotencyKey: conflictKey }),
      ]);
      expect(conflictResults.filter((result) => result.ok)).toHaveLength(1);
      expect(conflictResults.filter((result) => !result.ok)).toEqual([
        { ok: false, reason: "conflict" },
      ]);
    });
  },
);
