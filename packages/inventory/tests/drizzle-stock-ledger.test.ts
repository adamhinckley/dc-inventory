import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { DrizzleInventoryReadModel } from "../src/adapters/drizzle-inventory-read-model.js";
import { RECEIVE_COVER_MOVEMENT_TYPES } from "../src/domain/cover-policy.js";
import { DrizzleStockLedger, type InventoryDrizzle } from "../src/adapters/drizzle-stock-ledger.js";
import { stockMovements, stockSnapshots } from "../src/persistence/schema.js";

const ORG = OrganizationId.DEFAULT;
const LOCATION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const PO_ID = "550e8400-e29b-41d4-a716-446655440100";
const OTHER_PO_ID = "550e8400-e29b-41d4-a716-446655440101";

/**
 * Round trips the Postgres adapter spends per PO line once the snapshot rows are
 * locked: one movement conflict check, one movement insert, one snapshot update.
 * Every extra read here costs a full network round trip on every inventory write.
 */
const ROUND_TRIPS_PER_LINE = 3;
/** `lockSnapshots`: one `insert … on conflict do nothing`, one `select … for update`. */
const ROUND_TRIPS_TO_LOCK = 2;

async function createInventorySchema(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA inventory;
    CREATE TYPE inventory.movement_type AS ENUM (
      'InboundFromPo', 'GoodsReceived', 'InboundCancelled', 'Allocated', 'Deallocated',
      'Shipped', 'Committed', 'Decommitted', 'AdjustmentIncrease', 'AdjustmentDecrease'
    );
    CREATE TYPE inventory.movement_ref_type AS ENUM ('purchase_order', 'sales_order', 'adjustment');

    CREATE TABLE inventory.locations (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      code text NOT NULL,
      is_pick_bin boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, code)
    );

    CREATE TABLE inventory.stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id text NOT NULL,
      sku text NOT NULL,
      location_id uuid NOT NULL REFERENCES inventory.locations(id),
      movement_type inventory.movement_type NOT NULL,
      qty integer NOT NULL CHECK (qty > 0),
      ref_type inventory.movement_ref_type NOT NULL,
      ref_id uuid NOT NULL,
      idempotency_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX stock_movements_organization_id_idempotency_key_sku
      ON inventory.stock_movements (organization_id, idempotency_key, sku);
    CREATE UNIQUE INDEX stock_movements_organization_id_once_only_provenance
      ON inventory.stock_movements (organization_id, ref_type, ref_id, sku, movement_type)
      WHERE movement_type IN ('InboundFromPo', 'InboundCancelled', 'Deallocated', 'Shipped');

    CREATE TABLE inventory.stock_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id text NOT NULL,
      sku text NOT NULL,
      location_id uuid NOT NULL REFERENCES inventory.locations(id),
      on_hand integer NOT NULL DEFAULT 0,
      allocated integer NOT NULL DEFAULT 0,
      on_order integer NOT NULL DEFAULT 0,
      committed integer NOT NULL DEFAULT 0,
      sticky_locked boolean NOT NULL DEFAULT false,
      window_opens_at timestamptz,
      window_closes_at timestamptz,
      available integer GENERATED ALWAYS AS (on_hand - allocated) STORED NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, sku, location_id)
    );
  `);
  await client.query(
    `INSERT INTO inventory.locations (id, organization_id, code) VALUES ($1, $2, 'DEFAULT')`,
    [LOCATION_UUID, ORG],
  );
}

function skus(count: number): Sku[] {
  return Array.from({ length: count }, (_, index) => Sku.parse(`SKU-${index + 1}`));
}

describe("DrizzleStockLedger round trips", () => {
  let client: PGlite;
  let db: InventoryDrizzle;
  let ledger: DrizzleStockLedger;
  let queryLog: string[];

  beforeEach(async () => {
    client = new PGlite();
    await createInventorySchema(client);
    queryLog = [];
    db = drizzle(client, {
      schema: { stockMovements, stockSnapshots },
      logger: { logQuery: (query) => queryLog.push(query) },
    }) as unknown as InventoryDrizzle;
    const clock = new InMemoryClock(new Date("2026-09-09T12:00:00.000Z"));
    const resolveLocationUuid = async () => LOCATION_UUID;
    const readModel = new DrizzleInventoryReadModel(db, resolveLocationUuid, clock);
    ledger = new DrizzleStockLedger(db, readModel, resolveLocationUuid, clock);
  });

  afterEach(async () => {
    await client.close();
  });

  async function confirmPurchaseOrder(lineSkus: readonly Sku[], purchaseOrderId = PO_ID) {
    await ledger.lockSnapshots(lineSkus.map((sku) => ({ organizationId: ORG, sku })));
    for (const sku of lineSkus) {
      const result = await ledger.recordInboundFromPo({
        organizationId: ORG,
        idempotencyKey: `${purchaseOrderId}:${sku.value}`,
        sku,
        quantity: 10,
        refType: "purchase_order",
        refId: purchaseOrderId,
      });
      expect(result.ok).toBe(true);
    }
  }

  it("spends a fixed number of round trips per PO line after locking the snapshots", async () => {
    const lineSkus = skus(8);

    await confirmPurchaseOrder(lineSkus);

    expect(queryLog).toHaveLength(ROUND_TRIPS_TO_LOCK + ROUND_TRIPS_PER_LINE * lineSkus.length);
  });

  it("batches inbound bulk writes after a single lock instead of 3 round trips per line", async () => {
    const lineSkus = skus(10);

    queryLog = [];
    const bulkResult = await ledger.recordInboundFromPoBulk(
      lineSkus.map((sku) => ({
        organizationId: ORG,
        idempotencyKey: `${PO_ID}:${sku.value}`,
        sku,
        quantity: 10,
        refType: "purchase_order",
        refId: PO_ID,
      })),
    );
    expect(bulkResult.ok).toBe(true);

    const perLineQueries = ROUND_TRIPS_TO_LOCK + ROUND_TRIPS_PER_LINE * lineSkus.length;
    const movementInserts = queryLog.filter(
      (query) => query.startsWith("insert into") && query.includes('"inventory"."stock_movements"'),
    ).length;
    const snapshotUpdates = queryLog.filter(
      (query) =>
        query.trim().toLowerCase().startsWith("update") && query.includes("stock_snapshots"),
    ).length;
    expect(movementInserts).toBe(1);
    expect(snapshotUpdates).toBe(1);
    expect(queryLog.length).toBeLessThan(perLineQueries);
  });

  it("batches committed bulk writes with one conflict prefetch instead of per-line lookups", async () => {
    const lineSkus = skus(10);
    const salesOrderId = "550e8400-e29b-41d4-a716-446655440200";

    queryLog = [];
    const bulkResult = await ledger.recordCommittedBulk(
      lineSkus.map((sku) => ({
        organizationId: ORG,
        idempotencyKey: `commit-bulk:${sku.value}`,
        sku,
        quantity: 2,
        refType: "sales_order",
        refId: salesOrderId,
      })),
    );
    expect(bulkResult.ok).toBe(true);

    const movementConflictQueries = queryLog.filter(
      (query) =>
        query.startsWith("select") &&
        query.includes('"inventory"."stock_movements"') &&
        query.includes('"idempotency_key"'),
    );
    expect(movementConflictQueries).toHaveLength(1);
    expect(
      queryLog.filter(
        (query) => query.startsWith("insert into") && query.includes('"inventory"."stock_movements"'),
      ),
    ).toHaveLength(1);
  });

  it("rejects duplicate once-only provenance within the same bulk batch", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const command = {
      organizationId: ORG,
      idempotencyKey: "dup-inbound:first",
      sku,
      quantity: 5,
      refType: "purchase_order" as const,
      refId: PO_ID,
    };

    const bulkResult = await ledger.recordInboundFromPoBulk([
      command,
      { ...command, idempotencyKey: "dup-inbound:second" },
    ]);

    expect(bulkResult.ok).toBe(false);
    if (!bulkResult.ok) {
      expect(bulkResult.reason).toBe("provenance_conflict");
    }
    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM inventory.stock_movements`,
    );
    expect(count.rows[0]?.n).toBe(0);
  });

  it("does not re-read a snapshot row it already holds a lock on", async () => {
    const lineSkus = skus(3);

    await confirmPurchaseOrder(lineSkus);

    const snapshotReads = queryLog.filter(
      (query) => query.startsWith("select") && query.includes('"inventory"."stock_snapshots"'),
    );
    expect(snapshotReads).toHaveLength(1);
  });

  it("writes one movement per line and accumulates on_order on the snapshot", async () => {
    const [first, second] = skus(2);
    if (first === undefined || second === undefined) throw new Error("fixture");

    await confirmPurchaseOrder([first, second]);
    await confirmPurchaseOrder([first], OTHER_PO_ID);

    const movements = await client.query<{ sku: string; qty: number }>(
      `SELECT sku, qty FROM inventory.stock_movements ORDER BY sku, created_at`,
    );
    expect(movements.rows).toEqual([
      { sku: "SKU-1", qty: 10 },
      { sku: "SKU-1", qty: 10 },
      { sku: "SKU-2", qty: 10 },
    ]);
    const snapshots = await client.query<{ sku: string; on_order: number }>(
      `SELECT sku, on_order FROM inventory.stock_snapshots ORDER BY sku`,
    );
    expect(snapshots.rows).toEqual([
      { sku: "SKU-1", on_order: 20 },
      { sku: "SKU-2", on_order: 10 },
    ]);
  });

  it("replays an identical command without inserting a second movement", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const command = {
      organizationId: ORG,
      idempotencyKey: "confirm:SKU-1",
      sku,
      quantity: 10,
      refType: "purchase_order" as const,
      refId: PO_ID,
    };

    const first = await ledger.recordInboundFromPo(command);
    const replay = await ledger.recordInboundFromPo(command);

    expect(first.ok && replay.ok && replay.movement?.id).toBe(first.ok && first.movement?.id);
    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM inventory.stock_movements`,
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it("rejects a changed command under a reused idempotency key", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const command = {
      organizationId: ORG,
      idempotencyKey: "confirm:SKU-1",
      sku,
      refType: "purchase_order" as const,
      refId: PO_ID,
    };

    await ledger.recordInboundFromPo({ ...command, quantity: 10 });
    const changed = await ledger.recordInboundFromPo({ ...command, quantity: 11 });

    expect(changed).toEqual({ ok: false, reason: "idempotency_conflict" });
  });

  it("rejects a second InboundFromPo for the same PO and SKU under a new key", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const command = {
      organizationId: ORG,
      sku,
      quantity: 10,
      refType: "purchase_order" as const,
      refId: PO_ID,
    };

    await ledger.recordInboundFromPo({ ...command, idempotencyKey: "first" });
    const duplicate = await ledger.recordInboundFromPo({ ...command, idempotencyKey: "second" });
    const otherPo = await ledger.recordInboundFromPo({
      ...command,
      idempotencyKey: "third",
      refId: OTHER_PO_ID,
    });

    expect(duplicate).toEqual({ ok: false, reason: "provenance_conflict" });
    expect(otherPo.ok).toBe(true);
  });

  it("filters receive-cover movement list to sales-order cover types in SQL", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const salesOrderId = "550e8400-e29b-41d4-a716-446655440200";
    const noiseRefId = "550e8400-e29b-41d4-a716-446655440201";

    await confirmPurchaseOrder([sku]);
    const committed = await ledger.recordCommitted({
      organizationId: ORG,
      idempotencyKey: "commit:SKU-1",
      sku,
      quantity: 5,
      refType: "sales_order",
      refId: salesOrderId,
    });
    expect(committed.ok).toBe(true);

    await client.query(
      `INSERT INTO inventory.stock_movements
         (organization_id, sku, location_id, movement_type, qty, ref_type, ref_id, idempotency_key)
       VALUES
         ($1, $2, $3, 'AdjustmentIncrease', 1, 'adjustment', $4, 'noise-adjust'),
         ($1, $2, $3, 'Shipped', 1, 'sales_order', $4, 'noise-ship')`,
      [ORG, sku.value, LOCATION_UUID, noiseRefId],
    );

    queryLog = [];
    const received = await ledger.recordGoodsReceived({
      organizationId: ORG,
      idempotencyKey: "receive:SKU-1",
      sku,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_ID,
    });
    expect(received.ok).toBe(true);

    const coverListQueries = queryLog.filter(
      (query) =>
        query.startsWith("select") &&
        query.includes('"inventory"."stock_movements"') &&
        query.includes('"movement_type" in'),
    );
    expect(coverListQueries.length).toBeGreaterThan(0);
    for (const query of coverListQueries) {
      expect(query).toContain('"ref_type" =');
      expect(query).toContain('"movement_type" in');
      expect(query).toMatch(
        /"movement_type" in \(\$\d+, \$\d+, \$\d+, \$\d+\)/,
      );
      expect(RECEIVE_COVER_MOVEMENT_TYPES).toHaveLength(4);
      expect(query).not.toContain("'GoodsReceived'");
      expect(query).not.toContain("'InboundFromPo'");
      expect(query).not.toContain("'Shipped'");
      expect(query).not.toContain("'AdjustmentIncrease'");
    }

    const allocated = await client.query<{ movement_type: string; qty: number }>(
      `SELECT movement_type, qty
       FROM inventory.stock_movements
       WHERE idempotency_key LIKE 'receive:SKU-1:cover:%'`,
    );
    expect(allocated.rows).toEqual([{ movement_type: "Allocated", qty: 5 }]);
  });

  it("guards later commands against figures it wrote earlier in the same transaction", async () => {
    const [sku] = skus(1);
    if (sku === undefined) throw new Error("fixture");
    const salesOrderId = "550e8400-e29b-41d4-a716-446655440200";

    await confirmPurchaseOrder([sku]);
    const received = await ledger.recordGoodsReceived({
      organizationId: ORG,
      idempotencyKey: "receive:SKU-1",
      sku,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_ID,
    });
    const overAllocate = await ledger.recordAllocated({
      organizationId: ORG,
      idempotencyKey: "allocate-11:SKU-1",
      sku,
      quantity: 11,
      refType: "sales_order",
      refId: salesOrderId,
    });
    const allocate = await ledger.recordAllocated({
      organizationId: ORG,
      idempotencyKey: "allocate-10:SKU-1",
      sku,
      quantity: 10,
      refType: "sales_order",
      refId: salesOrderId,
    });

    expect(received.ok).toBe(true);
    expect(overAllocate).toEqual({ ok: false, reason: "insufficient_available" });
    expect(allocate.ok).toBe(true);
    const snapshot = await client.query<{
      on_hand: number;
      on_order: number;
      allocated: number;
      sticky_locked: boolean;
    }>(
      `SELECT on_hand, on_order, allocated, sticky_locked
       FROM inventory.stock_snapshots WHERE sku = 'SKU-1'`,
    );
    expect(snapshot.rows[0]).toEqual({
      on_hand: 10,
      on_order: 0,
      allocated: 10,
      sticky_locked: true,
    });
  });

  it("locks all close-skus snapshots once instead of once per SKU", async () => {
    const lineSkus = skus(8);
    const windowOpens = new Date("2026-09-01T00:00:00.000Z");
    const windowCloses = new Date("2026-09-30T00:00:00.000Z");

    await confirmPurchaseOrder(lineSkus);
    await ledger.reopenSkusForPresell({
      organizationId: ORG,
      skus: lineSkus,
      windowOpensAt: windowOpens,
      windowClosesAt: windowCloses,
    });

    const clock = new InMemoryClock(new Date("2026-09-09T12:00:00.000Z"));
    const resolveLocationUuid = async () => LOCATION_UUID;
    const readModel = new DrizzleInventoryReadModel(db, resolveLocationUuid, clock);
    const closeLedger = new DrizzleStockLedger(db, readModel, resolveLocationUuid, clock);

    queryLog = [];
    const lockSnapshots = vi.spyOn(closeLedger, "lockSnapshots");
    const result = await closeLedger.closeSkusForPresell({
      organizationId: ORG,
      skus: lineSkus,
    });

    expect(result).toEqual({ ok: true, closedCount: lineSkus.length });
    expect(lockSnapshots).toHaveBeenCalledTimes(1);
    expect(lockSnapshots.mock.calls[0]?.[0]).toHaveLength(lineSkus.length);

    const snapshotLockQueries = queryLog.filter(
      (query) => query.startsWith("select") && query.includes('"inventory"."stock_snapshots"'),
    );
    expect(snapshotLockQueries).toHaveLength(1);
    expect(
      queryLog.filter(
        (query) =>
          query.trim().toLowerCase().startsWith("update") && query.includes("stock_snapshots"),
      ),
    ).toHaveLength(1);
    lockSnapshots.mockRestore();
  });
});
