import { describe, expect, it } from "vitest";
import {
  COVER_PRODUCT_ID,
  COVER_SKU,
  CUSTOMER_ID,
  DEFAULT_LOCATION,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  LOCK_SKU,
  OPEN_PRODUCT_ID,
  OPEN_SKU,
  salesDemandHarness,
  seedOnHand,
  seedStickyLockedOnHand,
  STAFF_ID,
  PO_COVER,
} from "./support/sales-demand-harness.js";

describe("Line-level decommit (ADA-181)", () => {
  it("decommits one confirmed line and deallocates cover while other lines stay", async () => {
    const h = salesDemandHarness();
    await seedStickyLockedOnHand(h, LOCK_SKU, 30, PO_COVER, "line-decommit-lock");
    await seedOnHand(h, OPEN_SKU, 10, "line-decommit-open");

    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: LOCK_PRODUCT_ID, qty: 12 },
        { productId: OPEN_PRODUCT_ID, qty: 5 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      idempotencyKey: "multi-line-confirm",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }

    const beforeLock = await h.demandSnapshot(LOCK_SKU);
    const beforeOpen = await h.demandSnapshot(OPEN_SKU);
    expect(beforeLock.committed).toBe(12);
    expect(beforeLock.allocated).toBe(12);
    expect(beforeLock.availableToSell).toBe(18);
    expect(beforeOpen.committed).toBe(5);
    expect(beforeOpen.allocated).toBe(5);

    const lockLine = created.salesOrder.lines.find((line) => line.sku.equals(LOCK_SKU));
    expect(lockLine).toBeDefined();
    if (lockLine === undefined) {
      return;
    }

    const decommitted = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: created.salesOrder.id,
      lineId: lockLine.id,
      idempotencyKey: "code-red-lock-line",
    });
    expect(decommitted.ok).toBe(true);
    if (!decommitted.ok) {
      return;
    }
    expect(decommitted.salesOrder.status).toBe("confirmed");
    expect(decommitted.salesOrder.lines).toHaveLength(2);

    const decommittedLine = decommitted.salesOrder.lines.find((line) => line.id === lockLine.id);
    const remainingLine = decommitted.salesOrder.lines.find((line) => line.sku.equals(OPEN_SKU));
    expect(decommittedLine?.decommitted).toBe(true);
    expect(remainingLine?.decommitted).toBeUndefined();
    expect(remainingLine?.qty).toBe(5);

    const afterLock = await h.demandSnapshot(LOCK_SKU);
    const afterOpen = await h.demandSnapshot(OPEN_SKU);
    expect(afterLock.committed).toBe(0);
    expect(afterLock.allocated).toBe(0);
    expect(afterLock.available).toBe(30);
    expect(afterLock.availableToSell).toBe(30);
    expect(afterOpen.committed).toBe(5);
    expect(afterOpen.allocated).toBe(5);

    const lockMovements = await h.readModel.listMovements({
      organizationId: DEFAULT_ORG,
      sku: LOCK_SKU,
      locationId: DEFAULT_LOCATION,
    });
    const movementTypes = lockMovements.map((movement) => movement.movementType as string);
    expect(movementTypes).toContain("Decommitted");
    expect(movementTypes).toContain("Deallocated");
  });

  it("raises locked availableToSell when a covered line is decommitted", async () => {
    const h = salesDemandHarness();
    await seedStickyLockedOnHand(h, LOCK_SKU, 20, PO_COVER, "line-decommit-atp");

    const draft = await h.createDraft(LOCK_PRODUCT_ID, 12);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "atp-confirm",
    });
    expect(confirmed.ok).toBe(true);

    const before = await h.demandSnapshot(LOCK_SKU);
    expect(before.committed).toBe(12);
    expect(before.allocated).toBe(12);
    expect(before.availableToSell).toBe(8);

    const order = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
    const line = order?.lines[0];
    expect(line).toBeDefined();
    if (line === undefined) {
      return;
    }

    const decommitted = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      lineId: line.id,
      idempotencyKey: "atp-decommit",
    });
    expect(decommitted.ok).toBe(true);

    const after = await h.demandSnapshot(LOCK_SKU);
    expect(after.committed).toBe(0);
    expect(after.allocated).toBe(0);
    expect(after.availableToSell).toBe(20);
  });

  it("is idempotent when retried with the same idempotency key", async () => {
    const h = salesDemandHarness();
    await seedOnHand(h, COVER_SKU, 50, "line-decommit-retry");

    const draft = await h.createDraft(COVER_PRODUCT_ID, 8);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "retry-confirm",
    });
    expect(confirmed.ok).toBe(true);

    const order = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
    const line = order?.lines[0];
    expect(line).toBeDefined();
    if (line === undefined) {
      return;
    }

    const first = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      lineId: line.id,
      idempotencyKey: "retry-decommit",
    });
    expect(first.ok).toBe(true);

    const afterFirst = await h.demandSnapshot(COVER_SKU);
    expect(afterFirst.committed).toBe(0);
    expect(afterFirst.allocated).toBe(0);

    const retry = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      lineId: line.id,
      idempotencyKey: "retry-decommit",
    });
    expect(retry.ok).toBe(true);

    const afterRetry = await h.demandSnapshot(COVER_SKU);
    expect(afterRetry.committed).toBe(0);
    expect(afterRetry.allocated).toBe(0);

    const movements = await h.readModel.listMovements({
      organizationId: DEFAULT_ORG,
      sku: COVER_SKU,
      locationId: DEFAULT_LOCATION,
    });
    const decommittedMovements = movements.filter(
      (movement) => movement.movementType === "Decommitted",
    );
    expect(decommittedMovements).toHaveLength(1);
    expect(decommittedMovements[0]?.quantity).toBe(8);
  });

  it("rejects decommit on draft, shipped, or cancelled orders", async () => {
    const h = salesDemandHarness();
    await seedOnHand(h, LOCK_SKU, 20, "line-decommit-guard");

    const draftOrder = await h.createDraft(LOCK_PRODUCT_ID, 4);
    expect(draftOrder.ok).toBe(true);
    if (!draftOrder.ok) {
      return;
    }

    const draft = await h.uow.salesOrders.findById(DEFAULT_ORG, draftOrder.salesOrderId);
    const draftLine = draft?.lines[0];
    expect(draftLine).toBeDefined();
    if (draftLine === undefined) {
      return;
    }

    const onDraft = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draftOrder.salesOrderId,
      lineId: draftLine.id,
      idempotencyKey: "draft-decommit",
    });
    expect(onDraft.ok).toBe(false);
    if (onDraft.ok) {
      return;
    }
    expect(onDraft.reason).toBe("illegal_transition");

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draftOrder.salesOrderId,
      idempotencyKey: "guard-confirm",
    });
    expect(confirmed.ok).toBe(true);

    const cancelled = await h.cancel.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draftOrder.salesOrderId,
      idempotencyKey: "guard-cancel",
    });
    expect(cancelled.ok).toBe(true);

    const cancelledOrder = await h.uow.salesOrders.findById(DEFAULT_ORG, draftOrder.salesOrderId);
    const cancelledLine = cancelledOrder?.lines[0];
    expect(cancelledLine).toBeDefined();
    if (cancelledLine === undefined) {
      return;
    }

    const onCancelled = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draftOrder.salesOrderId,
      lineId: cancelledLine.id,
      idempotencyKey: "cancelled-decommit",
    });
    expect(onCancelled.ok).toBe(false);
    if (onCancelled.ok) {
      return;
    }
    expect(onCancelled.reason).toBe("illegal_transition");

    const shipDraft = await h.createDraft(LOCK_PRODUCT_ID, 3);
    expect(shipDraft.ok).toBe(true);
    if (!shipDraft.ok) {
      return;
    }
    await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: shipDraft.salesOrderId,
      idempotencyKey: "ship-guard-confirm",
    });
    await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: shipDraft.salesOrderId,
      idempotencyKey: "ship-guard-ship",
    });

    const shippedOrder = await h.uow.salesOrders.findById(DEFAULT_ORG, shipDraft.salesOrderId);
    const shippedLine = shippedOrder?.lines[0];
    expect(shippedLine).toBeDefined();
    if (shippedLine === undefined) {
      return;
    }

    const onShipped = await h.decommitLine.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: shipDraft.salesOrderId,
      lineId: shippedLine.id,
      idempotencyKey: "shipped-decommit",
    });
    expect(onShipped.ok).toBe(false);
    if (onShipped.ok) {
      return;
    }
    expect(onShipped.reason).toBe("illegal_transition");
  });
});
