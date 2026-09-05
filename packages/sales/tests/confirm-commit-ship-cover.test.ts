import { computeUncovered } from "@dc-inventory/inventory";
import { OrderId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  COVER_PRODUCT_ID,
  COVER_SKU,
  DEFAULT_LOCATION,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  LOCK_SKU,
  OPEN_PRODUCT_ID,
  OPEN_SKU,
  PO_COVER,
  salesDemandHarness,
  seedLockedCommittedWithoutCover,
  seedOnHand,
  seedStickyLockedOnHand,
  STAFF_ID,
} from "./support/sales-demand-harness.js";

const SO_LOCKED_FAIL = OrderId.parse("550e8400-e29b-41d4-a716-446655440061");

describe("Sales confirm commits and ship cover (ADA-177)", () => {
  /** Expected to pass after ADA-178. */
  const ownerIt = it;

  describe("open SKU confirm writes Committed and covers Allocated to leftover available (I6, G2)", () => {
    ownerIt("confirms far above on_hand with Committed only when no warehouse leftover exists", async () => {
      const h = salesDemandHarness();
      const draft = await h.createDraft(OPEN_PRODUCT_ID, 100_000);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "open-commit-100k",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      const snapshot = await h.demandSnapshot(OPEN_SKU);
      expect(snapshot.onHand).toBe(0);
      expect(snapshot.committed).toBe(100_000);
      expect(snapshot.allocated).toBe(0);
      expect(snapshot.available).toBe(0);
      expect(snapshot.sellState).toBe("open");
      expect(snapshot.availableToSell).toBeNull();
      expect(snapshot.uncovered).toBe(computeUncovered(100_000, 0, 0));

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: OPEN_SKU,
        locationId: DEFAULT_LOCATION,
      });
      const committedMovements = movements.filter((movement) => movement.movementType === "Committed");
      const allocatedMovements = movements.filter((movement) => movement.movementType === "Allocated");
      expect(committedMovements).toHaveLength(1);
      expect(committedMovements[0]?.quantity).toBe(100_000);
      expect(allocatedMovements).toHaveLength(0);
    });

    ownerIt("covers Allocated only up to leftover available when on_hand is partial", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, OPEN_SKU, 30, "open-partial-cover");

      const draft = await h.createDraft(OPEN_PRODUCT_ID, 100);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "open-partial-cover",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      const snapshot = await h.demandSnapshot(OPEN_SKU);
      expect(snapshot.onHand).toBe(30);
      expect(snapshot.committed).toBe(100);
      expect(snapshot.allocated).toBe(30);
      expect(snapshot.available).toBe(0);
      expect(snapshot.available).toBeGreaterThanOrEqual(0);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: OPEN_SKU,
        locationId: DEFAULT_LOCATION,
      });
      const allocatedAtConfirm = movements.filter((movement) => movement.movementType === "Allocated");
      expect(allocatedAtConfirm).toHaveLength(1);
      expect(allocatedAtConfirm[0]?.quantity).toBe(30);
    });
  });

  describe("locked SKU confirm gates on availableToSell (I9, G4)", () => {
    ownerIt("rejects a confirm that exceeds availableToSell all-or-nothing even when warehouse available would allow allocate", async () => {
      const h = salesDemandHarness();
      await seedLockedCommittedWithoutCover(
        h,
        LOCK_SKU,
        200,
        600,
        PO_COVER,
        SO_LOCKED_FAIL,
        "locked-atp-gate",
      );

      const before = await h.demandSnapshot(LOCK_SKU);
      expect(before.onHand).toBe(600);
      expect(before.committed).toBe(200);
      expect(before.allocated).toBe(0);
      expect(before.available).toBe(600);
      expect(before.availableToSell).toBe(400);
      expect(before.sellState).toBe("locked");

      const draft = await h.createDraft(LOCK_PRODUCT_ID, 401);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const failed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "locked-oversell-401",
        shipToId: h.shipToId,
      });
      expect(failed.ok).toBe(false);
      if (failed.ok) {
        return;
      }
      expect(failed.reason).toBe("insufficient_atp");

      const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
      expect(reloaded?.status).toBe("draft");

      const after = await h.demandSnapshot(LOCK_SKU);
      expect(after.committed).toBe(200);
      expect(after.allocated).toBe(0);
      expect(after.available).toBe(600);
      expect(after.availableToSell).toBe(400);
    });
  });

  describe("serialized locked confirms (I8)", () => {
    ownerIt("cannot let two confirms together exceed locked availableToSell", async () => {
      const h = salesDemandHarness();
      await seedStickyLockedOnHand(h, LOCK_SKU, 500, PO_COVER, "concurrent-lock");

      const firstDraft = await h.createDraft(LOCK_PRODUCT_ID, 300);
      expect(firstDraft.ok).toBe(true);
      if (!firstDraft.ok) {
        return;
      }

      const firstConfirm = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: firstDraft.salesOrderId,
        idempotencyKey: "concurrent-a",
        shipToId: h.shipToId,
      });
      expect(firstConfirm.ok).toBe(true);

      const secondDraft = await h.createDraft(LOCK_PRODUCT_ID, 300);
      expect(secondDraft.ok).toBe(true);
      if (!secondDraft.ok) {
        return;
      }
      expect(secondDraft.salesOrderId).not.toBe(firstDraft.salesOrderId);

      const secondConfirm = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: secondDraft.salesOrderId,
        idempotencyKey: "concurrent-b",
        shipToId: h.shipToId,
      });
      expect(secondConfirm.ok).toBe(false);
      if (secondConfirm.ok) {
        return;
      }
      expect(secondConfirm.reason).toBe("insufficient_atp");

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.committed).toBe(300);
      expect(snapshot.availableToSell).toBe(200);
      expect(snapshot.allocated).toBe(300);
    });
  });

  describe("cancel compensations (I9, G2)", () => {
    ownerIt("emits Decommitted and Deallocated when a confirmed order is cancelled", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, LOCK_SKU, 20, "cancel-confirmed");

      const draft = await h.createDraft(LOCK_PRODUCT_ID, 12);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "cancel-cover-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      const cancelled = await h.cancel.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "cancel-cover",
      });
      expect(cancelled.ok).toBe(true);

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.committed).toBe(0);
      expect(snapshot.allocated).toBe(0);
      expect(snapshot.available).toBe(20);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: LOCK_SKU,
        locationId: DEFAULT_LOCATION,
      });
      const movementTypes = movements.map((movement) => movement.movementType as string);
      expect(movementTypes).toContain("Decommitted");
      expect(movementTypes).toContain("Deallocated");
    });

    it("leaves stock unchanged when a draft order is cancelled", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, LOCK_SKU, 20, "cancel-draft");

      const draft = await h.createDraft(LOCK_PRODUCT_ID, 12);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const cancelled = await h.cancel.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "cancel-draft",
      });
      expect(cancelled.ok).toBe(true);

      const snapshot = await h.demandSnapshot(LOCK_SKU);
      expect(snapshot.onHand).toBe(20);
      expect(snapshot.committed).toBe(0);
      expect(snapshot.allocated).toBe(0);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: LOCK_SKU,
        locationId: DEFAULT_LOCATION,
      });
      expect(movements.filter((movement) => movement.refId === draft.salesOrderId)).toHaveLength(0);
    });
  });

  describe("ship requires full cover and still invoices (G2)", () => {
    ownerIt("fails ship until receive covers committed qty, then ships and posts invoice", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, COVER_SKU, 500, "ship-cover-floor");

      const draft = await h.createDraft(COVER_PRODUCT_ID, 1_200);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "ship-cover-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      const afterConfirm = await h.demandSnapshot(COVER_SKU);
      expect(afterConfirm.committed).toBe(1_200);
      expect(afterConfirm.allocated).toBe(500);
      expect(afterConfirm.uncovered).toBe(700);

      const shipBeforeReceive = await h.ship.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "ship-before-cover",
      });
      expect(shipBeforeReceive.ok).toBe(false);

      await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "ship-cover-po",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      const receive = await h.goodsReceived.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "ship-cover-receive",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      expect(receive.ok).toBe(true);

      const afterReceive = await h.demandSnapshot(COVER_SKU);
      expect(afterReceive.allocated).toBe(1_200);
      expect(afterReceive.committed).toBe(1_200);

      const shipped = await h.ship.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "ship-after-cover",
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) {
        return;
      }
      expect(shipped.salesOrder.status).toBe("shipped");

      const invoice = await h.uow.invoices.findByOrderId(DEFAULT_ORG, draft.salesOrderId);
      expect(invoice).not.toBeNull();
      expect(invoice?.taxTotal.amountMinor).toBe(0);
      expect(invoice?.total.amountMinor).toBe(1_200 * 900);
    });
  });

  describe("receive cover attribution (ADA-256)", () => {
    ownerIt("includes receive-time Allocated in order cover quantity", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, COVER_SKU, 500, "receive-cover-floor");

      const draft = await h.createDraft(COVER_PRODUCT_ID, 1_200);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "receive-cover-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      const coverAfterConfirm = await h.uow.inventory.getOrderCoverQuantity({
        organizationId: DEFAULT_ORG,
        sku: COVER_SKU,
        orderId: draft.salesOrderId,
      });
      expect(coverAfterConfirm).toBe(500);

      await h.inboundFromPo.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "receive-cover-po",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      const receive = await h.goodsReceived.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "receive-cover-receive",
        sku: COVER_SKU,
        quantity: 1_900,
        refType: "purchase_order",
        refId: PO_COVER,
      });
      expect(receive.ok).toBe(true);

      const coverAfterReceive = await h.uow.inventory.getOrderCoverQuantity({
        organizationId: DEFAULT_ORG,
        sku: COVER_SKU,
        orderId: draft.salesOrderId,
      });
      expect(coverAfterReceive).toBe(1_200);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: COVER_SKU,
        locationId: DEFAULT_LOCATION,
      });
      const receiveAllocated = movements.filter(
        (movement) =>
          movement.movementType === "Allocated" &&
          movement.refType === "sales_order" &&
          movement.refId === draft.salesOrderId &&
          movement.idempotencyKey === `receive-cover-receive:cover:${draft.salesOrderId}`,
      );
      expect(receiveAllocated).toHaveLength(1);
      expect(receiveAllocated[0]?.quantity).toBe(700);
    });
  });

  describe("confirm idempotency", () => {
    ownerIt("does not double-commit when confirm is retried with the same idempotency key", async () => {
      const h = salesDemandHarness();
      await seedOnHand(h, OPEN_SKU, 500, "confirm-retry-seed");
      const draft = await h.createDraft(OPEN_PRODUCT_ID, 100);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const first = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "confirm-retry",
        shipToId: h.shipToId,
      });
      expect(first.ok).toBe(true);

      const afterFirst = await h.demandSnapshot(OPEN_SKU);
      expect(afterFirst.committed).toBe(100);

      const retry = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "confirm-retry",
        shipToId: h.shipToId,
      });
      expect(retry.ok).toBe(true);

      const afterRetry = await h.demandSnapshot(OPEN_SKU);
      expect(afterRetry.committed).toBe(100);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        sku: OPEN_SKU,
        locationId: DEFAULT_LOCATION,
      });
      const committedMovements = movements.filter((movement) => movement.movementType === "Committed");
      expect(committedMovements).toHaveLength(1);
      expect(committedMovements[0]?.quantity).toBe(100);
    });
  });
});
