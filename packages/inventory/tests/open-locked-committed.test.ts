import { LocationId, OrganizationId, PurchaseOrderId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { MOVEMENT_TYPES } from "../src/index.js";
import {
  computeLockedAvailableToSell,
  computeUncovered,
  isDemandStockFigures,
} from "./support/demand-model-api.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const DEFAULT = LocationId.DEFAULT;

const OPEN_SKU = Sku.parse("PRESALE-OPEN-1");
const LOCK_SKU = Sku.parse("PRESALE-LOCK-1");
const COVER_SKU = Sku.parse("PRESALE-COVER-1");
const REOPEN_A = Sku.parse("REOPEN-A");
const REOPEN_B = Sku.parse("REOPEN-B");
const REOPEN_C = Sku.parse("REOPEN-C");
const WINDOW_SKU = Sku.parse("WINDOW-SKU-1");

const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440050");
const PO_COVER = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440051");
const SO_OPEN = "550e8400-e29b-41d4-a716-446655440060";
const SO_LOCKED = "550e8400-e29b-41d4-a716-446655440061";
const SO_COVER = "550e8400-e29b-41d4-a716-446655440062";
const SO_CONCURRENT_A = "550e8400-e29b-41d4-a716-446655440063";
const SO_CONCURRENT_B = "550e8400-e29b-41d4-a716-446655440064";
const SO_CANCEL = "550e8400-e29b-41d4-a716-446655440065";
const SO_WINDOW = "550e8400-e29b-41d4-a716-446655440066";
const SO_WINDOW_LEFT = "550e8400-e29b-41d4-a716-446655440067";

const WINDOW_OPENS = new Date("2026-07-01T00:00:00.000Z");
const WINDOW_CLOSES = new Date("2026-08-01T00:00:00.000Z");
const BEFORE_WINDOW = new Date("2026-06-15T12:00:00.000Z");
const INSIDE_WINDOW = new Date("2026-07-15T12:00:00.000Z");
const AFTER_WINDOW = new Date("2026-09-01T12:00:00.000Z");

/** Sticky-lock a SKU with on_order 0, then seed on-hand (ADR 0008: lock without open PO qty). */
async function seedStickyLockedOnHand(
  h: ReturnType<typeof demandModelHarness>,
  sku: Sku,
  onHand: number,
  poId: PurchaseOrderId,
  fixtureKey: string,
) {
  await h.inboundFromPo.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-inbound`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });
  await h.inboundCancelled.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-cancel`,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: poId,
  });
  await h.adjustmentIncrease.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey: `${fixtureKey}-on-hand`,
    sku,
    quantity: onHand,
    refType: "adjustment",
    refId: `${fixtureKey}-on-hand`,
  });
}

describe("Inventory demand model — open/locked, committed, cover (ADA-174)", () => {
  /** Expected to fail until ADA-176. Change to `it` when the demand-model ledger ships. */
  const ownerIt = it;

  describe("movement and snapshot contract", () => {
    ownerIt("includes Committed and Decommitted movement types", () => {
      expect(MOVEMENT_TYPES).toContain("Committed");
      expect(MOVEMENT_TYPES).toContain("Decommitted");
    });

    ownerIt("projects committed, sellState, availableToSell, and uncovered on the snapshot read model", async () => {
      const h = demandModelHarness();
      const snapshot = await h.baseSnapshot(OPEN_SKU);
      expect(isDemandStockFigures(snapshot)).toBe(true);
    });
  });

  describe("open SKU confirm (I6)", () => {
    ownerIt("accepts a confirm-sized Committed of 100_000 with on_hand 0 and on_order 0", async () => {
      const h = demandModelHarness();
      const result = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "open-commit-100k",
        sku: OPEN_SKU,
        quantity: 100_000,
        refType: "sales_order",
        refId: SO_OPEN,
      });
      expect(result.ok).toBe(true);

      const snapshot = await h.demandSnapshot(OPEN_SKU);
      expect(snapshot.onHand).toBe(0);
      expect(snapshot.onOrder).toBe(0);
      expect(snapshot.committed).toBe(100_000);
      expect(snapshot.sellState).toBe("open");
      expect(snapshot.availableToSell).toBeNull();
      expect(snapshot.uncovered).toBe(computeUncovered(100_000, 0, 0));
    });
  });

  describe("first InboundFromPo locks (I6)", () => {
    ownerIt("locks the SKU on first InboundFromPo and gates further Committed by on_hand + on_order − committed", async () => {
      const h = demandModelHarness();

      const openCommit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "pre-lock-commit",
        sku: LOCK_SKU,
        quantity: 50,
        refType: "sales_order",
        refId: SO_LOCKED,
      });
      expect(openCommit.ok).toBe(true);

      const inbound = await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "lock-on-first-po",
        sku: LOCK_SKU,
        quantity: 100,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(inbound.ok).toBe(true);

      const lockedSnapshot = await h.demandSnapshot(LOCK_SKU);
      expect(lockedSnapshot.sellState).toBe("locked");
      expect(lockedSnapshot.stickyLocked).toBe(true);
      expect(lockedSnapshot.onOrder).toBe(100);
      expect(lockedSnapshot.committed).toBe(50);
      expect(lockedSnapshot.availableToSell).toBe(
        computeLockedAvailableToSell(lockedSnapshot.onHand, lockedSnapshot.onOrder, lockedSnapshot.committed),
      );

      const oversell = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "post-lock-oversell",
        sku: LOCK_SKU,
        quantity: 51,
        refType: "sales_order",
        refId: SO_CONCURRENT_B,
      });
      expect(oversell.ok).toBe(false);
      if (oversell.ok) {
        return;
      }
      expect(oversell.reason).toBe("insufficient_available_to_sell");
      expect(await h.demandSnapshot(LOCK_SKU)).toMatchObject({
        committed: 50,
        onOrder: 100,
      });
    });
  });

  describe("locked availableToSell gate (I9, G4)", () => {
    ownerIt("rejects a commit of 501 when on_hand 500 leaves availableToSell 500 and keeps available at 500", async () => {
      const h = demandModelHarness();
      await seedStickyLockedOnHand(h, LOCK_SKU, 500, PO_ID, "lock-for-cap");

      const before = await h.demandSnapshot(LOCK_SKU);
      expect(before.onHand).toBe(500);
      expect(before.onOrder).toBe(0);
      expect(before.committed).toBe(0);
      expect(before.available).toBe(500);
      expect(before.availableToSell).toBe(500);
      expect(before.sellState).toBe("locked");

      const oversell = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "locked-oversell-501",
        sku: LOCK_SKU,
        quantity: 501,
        refType: "sales_order",
        refId: SO_LOCKED,
      });
      expect(oversell.ok).toBe(false);
      if (oversell.ok) {
        return;
      }
      expect(oversell.reason).toBe("insufficient_available_to_sell");

      const after = await h.baseSnapshot(LOCK_SKU);
      expect(after.available).toBe(500);
      expect(after.onHand).toBe(500);
      expect(after.allocated).toBe(0);
    });
  });

  describe("open presell with PO gap (ADR 0008 decision 6)", () => {
    ownerIt("after selling 1_200 on_hand 500 then PO 1_900 leaves uncovered 0 and availableToSell 1_200", async () => {
      const h = demandModelHarness();
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cover-floor-500",
        sku: COVER_SKU,
        quantity: 500,
        refType: "adjustment",
        refId: "cover-floor-500",
      });

      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cover-commit-1200",
        sku: COVER_SKU,
        quantity: 1_200,
        refType: "sales_order",
        refId: SO_COVER,
      });
      expect(commit.ok).toBe(true);

      const afterCommit = await h.demandSnapshot(COVER_SKU);
      expect(afterCommit.committed).toBe(1_200);
      expect(afterCommit.onHand).toBe(500);
      expect(afterCommit.uncovered).toBe(700);

      const inbound = await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cover-po-1900",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      expect(inbound.ok).toBe(true);

      const afterPo = await h.demandSnapshot(COVER_SKU);
      expect(afterPo.onHand).toBe(500);
      expect(afterPo.onOrder).toBe(1_900);
      expect(afterPo.committed).toBe(1_200);
      expect(afterPo.uncovered).toBe(0);
      expect(afterPo.availableToSell).toBe(1_200);
      expect(afterPo.sellState).toBe("locked");
    });
  });

  describe("warehouse leftover and FIFO cover (I3, G2)", () => {
    ownerIt("never lets available go negative and covers Allocated at confirm up to leftover available", async () => {
      const h = demandModelHarness();
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "alloc-cover-seed",
        sku: COVER_SKU,
        quantity: 30,
        refType: "adjustment",
        refId: "alloc-cover-seed",
      });

      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "alloc-cover-commit",
        sku: COVER_SKU,
        quantity: 100,
        refType: "sales_order",
        refId: SO_COVER,
      });
      expect(commit.ok).toBe(true);

      const afterCommit = await h.demandSnapshot(COVER_SKU);
      expect(afterCommit.available).toBe(0);
      expect(afterCommit.available).toBeGreaterThanOrEqual(0);
      expect(afterCommit.allocated).toBe(30);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: COVER_SKU,
        locationId: DEFAULT,
      });
      const allocatedAtConfirm = movements.filter((movement) => movement.movementType === "Allocated");
      expect(allocatedAtConfirm).toHaveLength(1);
      expect(allocatedAtConfirm[0]?.quantity).toBe(30);
    });

    ownerIt("FIFO-covers the remaining committed quantity when GoodsReceived raises on_hand", async () => {
      const h = demandModelHarness();
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "fifo-floor",
        sku: COVER_SKU,
        quantity: 500,
        refType: "adjustment",
        refId: "fifo-floor",
      });
      await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "fifo-commit",
        sku: COVER_SKU,
        quantity: 1_200,
        refType: "sales_order",
        refId: SO_COVER,
      });
      await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "fifo-po",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });

      const receive = await h.goodsReceived.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "fifo-receive",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      expect(receive.ok).toBe(true);

      const afterReceive = await h.demandSnapshot(COVER_SKU);
      expect(afterReceive.onHand).toBe(2_400);
      expect(afterReceive.onOrder).toBe(0);
      expect(afterReceive.committed).toBe(1_200);
      expect(afterReceive.allocated).toBe(1_200);
      expect(afterReceive.available).toBe(1_200);
      expect(afterReceive.available).toBeGreaterThanOrEqual(0);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: COVER_SKU,
        locationId: DEFAULT,
      });
      const allocatedMovements = movements.filter((movement) => movement.movementType === "Allocated");
      expect(allocatedMovements).toHaveLength(2);
      expect(allocatedMovements.map((movement) => movement.quantity).sort((a, b) => a - b)).toEqual([
        500,
        700,
      ]);
    });
  });

  describe("serialized locked confirms (I8)", () => {
    ownerIt("cannot let two locked confirms together exceed availableToSell", async () => {
      const h = demandModelHarness();
      await seedStickyLockedOnHand(h, LOCK_SKU, 500, PO_ID, "concurrent-lock");

      const [first, second] = await Promise.all([
        h.committed({
          organizationId: DEFAULT_ORG,
          idempotencyKey: "concurrent-a",
          sku: LOCK_SKU,
          quantity: 300,
          refType: "sales_order",
          refId: SO_CONCURRENT_A,
        }),
        h.committed({
          organizationId: DEFAULT_ORG,
          idempotencyKey: "concurrent-b",
          sku: LOCK_SKU,
          quantity: 300,
          refType: "sales_order",
          refId: SO_CONCURRENT_B,
        }),
      ]);

      const successes = [first, second].filter((result) => result.ok);
      expect(successes).toHaveLength(1);

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.committed).toBe(300);
      expect(snapshot.availableToSell).toBe(200);
    });
  });

  describe("sticky lock and reopen (ADR 0008 decision 3)", () => {
    async function lockSku(
      h: ReturnType<typeof demandModelHarness>,
      sku: Sku,
      poId: PurchaseOrderId,
      idempotencyKey: string,
    ) {
      await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey,
        sku,
        quantity: 10,
        refType: "purchase_order",
        refId: poId,
      });
    }

    ownerIt("does not reopen after InboundCancelled", async () => {
      const h = demandModelHarness();
      await lockSku(h, LOCK_SKU, PO_ID, "cancel-lock");
      await h.inboundCancelled.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cancel-inbound",
        sku: LOCK_SKU,
        quantity: 10,
        refType: "purchase_order",
        refId: PO_ID,
      });

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.sellState).toBe("locked");
      expect(snapshot.stickyLocked).toBe(true);
      expect(snapshot.onOrder).toBe(0);
    });

    ownerIt("reopens only the SKUs listed in ReopenSkusForPresell", async () => {
      const h = demandModelHarness(INSIDE_WINDOW);
      await lockSku(h, REOPEN_A, PO_ID, "reopen-lock-a");
      await lockSku(h, REOPEN_B, PO_ID, "reopen-lock-b");
      await lockSku(h, REOPEN_C, PO_ID, "reopen-lock-c");

      const reopen = await h.reopenSkusForPresell({
        organizationId: DEFAULT_ORG,
        skus: [REOPEN_A, REOPEN_B],
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      });
      expect(reopen.ok).toBe(true);

      const reopenedA = await h.demandSnapshot(REOPEN_A);
      const reopenedB = await h.demandSnapshot(REOPEN_B);
      const stillLocked = await h.demandSnapshot(REOPEN_C);

      expect(reopenedA.sellState).toBe("open");
      expect(reopenedB.sellState).toBe("open");
      expect(stillLocked.sellState).toBe("locked");
      expect(reopenedA.windowOpensAt?.toISOString()).toBe(WINDOW_OPENS.toISOString());
      expect(reopenedA.windowClosesAt?.toISOString()).toBe(WINDOW_CLOSES.toISOString());
    });
  });

  describe("sell window with injected clock (ADR 0008 decision 4)", () => {
    ownerIt("rejects windowOpensAt >= windowClosesAt", async () => {
      const h = demandModelHarness();
      const invalid = await h.setSellWindow({
        organizationId: DEFAULT_ORG,
        sku: WINDOW_SKU,
        windowOpensAt: WINDOW_CLOSES,
        windowClosesAt: WINDOW_OPENS,
      });
      expect(invalid.ok).toBe(false);
      if (invalid.ok) {
        return;
      }
      expect(invalid.reason).toBe("invalid_sell_window");
    });

    ownerIt("before windowOpensAt rejects an uncapped commit using the locked formula", async () => {
      const h = demandModelHarness(BEFORE_WINDOW);
      const setWindow = await h.setSellWindow({
        organizationId: DEFAULT_ORG,
        sku: WINDOW_SKU,
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      });
      expect(setWindow.ok).toBe(true);

      const oversell = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "before-window-infinity",
        sku: WINDOW_SKU,
        quantity: 100_000,
        refType: "sales_order",
        refId: SO_WINDOW,
      });
      expect(oversell.ok).toBe(false);
      if (oversell.ok) {
        return;
      }
      expect(oversell.reason).toBe("insufficient_available_to_sell");
    });

    ownerIt("after windowClosesAt with no PO rejects an uncapped commit but still sells leftover on_hand", async () => {
      const h = demandModelHarness(AFTER_WINDOW);
      await h.setSellWindow({
        organizationId: DEFAULT_ORG,
        sku: WINDOW_SKU,
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      });
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "leftover-on-hand",
        sku: WINDOW_SKU,
        quantity: 40,
        refType: "adjustment",
        refId: "leftover-on-hand",
      });

      const infinity = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "after-window-infinity",
        sku: WINDOW_SKU,
        quantity: 100_000,
        refType: "sales_order",
        refId: SO_WINDOW,
      });
      expect(infinity.ok).toBe(false);
      if (infinity.ok) {
        return;
      }
      expect(infinity.reason).toBe("insufficient_available_to_sell");

      const leftover = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "after-window-leftover",
        sku: WINDOW_SKU,
        quantity: 25,
        refType: "sales_order",
        refId: SO_WINDOW_LEFT,
      });
      expect(leftover.ok).toBe(true);

      const snapshot = await h.demandSnapshot(WINDOW_SKU);
      expect(snapshot.committed).toBe(25);
      expect(snapshot.availableToSell).toBe(15);
      expect(snapshot.sellState).toBe("locked");
    });

    ownerIt("locks immediately on first InboundFromPo even inside the sell window", async () => {
      const h = demandModelHarness(INSIDE_WINDOW);
      await h.setSellWindow({
        organizationId: DEFAULT_ORG,
        sku: WINDOW_SKU,
        windowOpensAt: WINDOW_OPENS,
        windowClosesAt: WINDOW_CLOSES,
      });

      const inbound = await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "window-po-lock",
        sku: WINDOW_SKU,
        quantity: 50,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(inbound.ok).toBe(true);

      const snapshot = await h.demandSnapshot(WINDOW_SKU);
      expect(snapshot.sellState).toBe("locked");
      expect(snapshot.stickyLocked).toBe(true);
    });
  });

  describe("sticky lock on window-close observation (ADR 0008 decision 4)", () => {
    ownerIt(
      "setSellWindow persists sticky from elapsed persisted window and does not reopen via extended dates",
      async () => {
        const clock = new InMemoryClock(INSIDE_WINDOW);
        const h = demandModelHarness(clock);
        await h.setSellWindow({
          organizationId: DEFAULT_ORG,
          sku: WINDOW_SKU,
          windowOpensAt: WINDOW_OPENS,
          windowClosesAt: WINDOW_CLOSES,
        });

        clock.advance(AFTER_WINDOW.getTime() - INSIDE_WINDOW.getTime());

        const extendedCloses = new Date("2027-08-01T00:00:00.000Z");
        await h.setSellWindow({
          organizationId: DEFAULT_ORG,
          sku: WINDOW_SKU,
          windowOpensAt: WINDOW_OPENS,
          windowClosesAt: extendedCloses,
        });

        const snapshot = await h.demandSnapshot(WINDOW_SKU);
        expect(snapshot.stickyLocked).toBe(true);
        expect(snapshot.sellState).toBe("locked");
        expect(snapshot.windowClosesAt?.toISOString()).toBe(WINDOW_CLOSES.toISOString());
      },
    );

    ownerIt(
      "Allocated persists sticky when clock has passed windowClosesAt without a prior observing write",
      async () => {
        const clock = new InMemoryClock(INSIDE_WINDOW);
        const h = demandModelHarness(clock);
        await h.setSellWindow({
          organizationId: DEFAULT_ORG,
          sku: WINDOW_SKU,
          windowOpensAt: WINDOW_OPENS,
          windowClosesAt: WINDOW_CLOSES,
        });
        await h.adjustmentIncrease.execute({
          organizationId: DEFAULT_ORG,
          idempotencyKey: "alloc-window-sticky-on-hand",
          sku: WINDOW_SKU,
          quantity: 50,
          refType: "adjustment",
          refId: "alloc-window-sticky-on-hand",
        });

        clock.advance(AFTER_WINDOW.getTime() - INSIDE_WINDOW.getTime());

        const beforeAlloc = await h.demandSnapshot(WINDOW_SKU);
        expect(beforeAlloc.stickyLocked).toBe(false);
        expect(beforeAlloc.sellState).toBe("locked");

        const alloc = await h.allocated.execute({
          organizationId: DEFAULT_ORG,
          idempotencyKey: "alloc-after-window-close",
          sku: WINDOW_SKU,
          quantity: 10,
          refType: "sales_order",
          refId: SO_WINDOW,
        });
        expect(alloc.ok).toBe(true);

        const snapshot = await h.demandSnapshot(WINDOW_SKU);
        expect(snapshot.stickyLocked).toBe(true);
      },
    );
  });

  describe("ship and cancel compensations (I9, G2)", () => {
    ownerIt("requires Allocated before Shipped", async () => {
      const h = demandModelHarness();
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "ship-without-alloc",
        sku: LOCK_SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "ship-without-alloc",
      });

      const ship = await h.shipped.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "ship-no-alloc",
        sku: LOCK_SKU,
        quantity: 5,
        refType: "sales_order",
        refId: SO_CANCEL,
      });
      expect(ship.ok).toBe(false);
      if (ship.ok) {
        return;
      }
      expect(ship.reason).toBe("insufficient_allocated");
    });

    ownerIt("emits Decommitted and Deallocated when a confirmed order is cancelled", async () => {
      const h = demandModelHarness();
      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cancel-cover-seed",
        sku: LOCK_SKU,
        quantity: 20,
        refType: "adjustment",
        refId: "cancel-cover-seed",
      });
      const commit = await h.committed({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cancel-cover-commit",
        sku: LOCK_SKU,
        quantity: 12,
        refType: "sales_order",
        refId: SO_CANCEL,
      });
      expect(commit.ok).toBe(true);

      const decommit = await h.decommitted({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cancel-decommit",
        sku: LOCK_SKU,
        quantity: 12,
        refType: "sales_order",
        refId: SO_CANCEL,
      });
      expect(decommit.ok).toBe(true);

      const deallocate = await h.deallocated.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "cancel-deallocate",
        sku: LOCK_SKU,
        quantity: 12,
        refType: "sales_order",
        refId: SO_CANCEL,
      });
      expect(deallocate.ok).toBe(true);

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.committed).toBe(0);
      expect(snapshot.allocated).toBe(0);
      expect(snapshot.available).toBe(20);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: LOCK_SKU,
        locationId: DEFAULT,
      });
      const movementTypes = movements.map((movement) => movement.movementType as string);
      expect(movementTypes).toContain("Decommitted");
      expect(movementTypes).toContain("Deallocated");
    });
  });
});
