import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCATION,
  DEFAULT_ORG,
  OPEN_PRODUCT_ID,
  OPEN_SKU,
  salesDemandHarness,
  seedOnHand,
  STAFF_ID,
} from "./support/sales-demand-harness.js";

describe("Sales ship bill-to gate (ADA-261, U7)", () => {
  it("refuses ship when customer has no bill-to; order stays confirmed; no invoice or shipment", async () => {
    const h = salesDemandHarness(undefined, { billTo: null });
    await seedOnHand(h, OPEN_SKU, 10, "bill-to-gate-seed");

    const draft = await h.createDraft(OPEN_PRODUCT_ID, 3);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "bill-to-gate-confirm",
      shipToId: h.shipToId,
    });
    expect(confirmed.ok).toBe(true);

    const result = await h.ship.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "bill-to-gate-ship",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("bill_to_missing");

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
    expect(reloaded?.status).toBe("confirmed");
    expect(await h.uow.invoices.findByOrderId(DEFAULT_ORG, draft.salesOrderId)).toBeNull();

    const snapshot = await h.demandSnapshot(OPEN_SKU);
    expect(snapshot.allocated).toBe(3);
    expect(snapshot.onHand).toBe(10);

    const movements = await h.readModel.listMovements({
      organizationId: DEFAULT_ORG,
      locationId: DEFAULT_LOCATION,
      sku: OPEN_SKU,
    });
    expect(movements.some((movement) => movement.movementType === "Shipped")).toBe(false);
  });

  it("confirms without bill-to on the customer (U7)", async () => {
    const h = salesDemandHarness(undefined, { billTo: null });
    await seedOnHand(h, OPEN_SKU, 5, "bill-to-gate-confirm-only");

    const draft = await h.createDraft(OPEN_PRODUCT_ID, 2);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const confirmed = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "bill-to-gate-confirm-without-bill-to",
      shipToId: h.shipToId,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      return;
    }
    expect(confirmed.salesOrder.status).toBe("confirmed");
  });
});
