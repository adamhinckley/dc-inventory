import type { AccountStatus } from "@dc-inventory/customers";
import { Money, OrderId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { SalesOrderLineId } from "../src/domain/ids.js";
import {
  CUSTOMER_ID,
  DEFAULT_LOCATION,
  DEFAULT_ORG,
  OPEN_PRODUCT_ID,
  OPEN_SKU,
  salesDemandHarness,
  seedOnHand,
  STAFF_ID,
} from "./support/sales-demand-harness.js";

function harnessForStatus(getAccountStatus: () => AccountStatus) {
  return salesDemandHarness(undefined, { getAccountStatus });
}

describe("Sales account status gates (ADA-263, U10)", () => {
  describe("on hold", () => {
    it("blocks confirm; draft stays draft; no Committed inventory", async () => {
      const h = harnessForStatus(() => "on_hold");
      await seedOnHand(h, OPEN_SKU, 10, "on-hold-confirm-seed");

      const draft = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 3);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const result = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "on-hold-confirm",
        shipToId: h.shipToId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("customer_on_hold");

      const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
      expect(reloaded?.status).toBe("draft");

      const snapshot = await h.demandSnapshot(OPEN_SKU);
      expect(snapshot.committed).toBe(0);
      expect(snapshot.allocated).toBe(0);

      const movements = await h.readModel.listMovements({
        organizationId: DEFAULT_ORG,
        locationId: DEFAULT_LOCATION,
        sku: OPEN_SKU,
      });
      expect(movements.some((movement) => movement.movementType === "Committed")).toBe(false);
    });

    // Create-only until Sales exposes a draft line-edit use case (U10 also allows edit).
    it("allows wholesale draft create while on hold", async () => {
      const h = harnessForStatus(() => "on_hold");

      const draft = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, draft.salesOrderId);
      expect(reloaded?.status).toBe("draft");
      expect(reloaded?.lines[0]?.qty).toBe(2);
    });

    it("blocks staff place-on-behalf create", async () => {
      const h = harnessForStatus(() => "on_hold");

      const result = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("customer_on_hold");
    });

    it("allows ship of an already-confirmed order after status moves to on hold", async () => {
      let status: AccountStatus = "active";
      const h = harnessForStatus(() => status);
      await seedOnHand(h, OPEN_SKU, 10, "on-hold-ship-seed");

      const draft = await h.createStaffDraft(OPEN_PRODUCT_ID, 3);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "on-hold-ship-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      status = "on_hold";

      const shipped = await h.ship.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "on-hold-ship",
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) {
        return;
      }
      expect(shipped.salesOrder.status).toBe("shipped");
    });
  });

  describe("inactive", () => {
    it("blocks confirm; draft stays draft; no Committed inventory", async () => {
      const h = harnessForStatus(() => "inactive");
      await seedOnHand(h, OPEN_SKU, 10, "inactive-confirm-seed");

      const inserted = await h.uow.salesOrders.insertWithNextDocumentNumber({
        id: OrderId.parse("550e8400-e29b-41d4-a716-446655440070"),
        organizationId: DEFAULT_ORG,
        customerId: CUSTOMER_ID,
        status: "draft",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        lines: [
          {
            id: SalesOrderLineId.parse("550e8400-e29b-41d4-a716-446655440071"),
            sku: OPEN_SKU,
            name: "Open presell widget",
            qty: 3,
            unitPrice: Money.fromMinorUnits(500, "USD"),
          },
        ],
      });

      const result = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: inserted.id,
        idempotencyKey: "inactive-confirm",
        shipToId: h.shipToId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("customer_inactive");

      const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, inserted.id);
      expect(reloaded?.status).toBe("draft");

      const snapshot = await h.demandSnapshot(OPEN_SKU);
      expect(snapshot.committed).toBe(0);
    });

    it("blocks wholesale new draft/cart create", async () => {
      const h = harnessForStatus(() => "inactive");

      const result = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("customer_inactive");
    });

    it("blocks staff place-on-behalf create", async () => {
      const h = harnessForStatus(() => "inactive");

      const result = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("customer_inactive");
    });

    it("allows ship of an already-confirmed order after status moves to inactive", async () => {
      let status: AccountStatus = "active";
      const h = harnessForStatus(() => status);
      await seedOnHand(h, OPEN_SKU, 10, "inactive-ship-seed");

      const draft = await h.createStaffDraft(OPEN_PRODUCT_ID, 3);
      expect(draft.ok).toBe(true);
      if (!draft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "inactive-ship-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);

      status = "inactive";

      const shipped = await h.ship.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: draft.salesOrderId,
        idempotencyKey: "inactive-ship",
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) {
        return;
      }
      expect(shipped.salesOrder.status).toBe("shipped");
    });
  });

  describe("active", () => {
    it("allows staff place-on-behalf, wholesale draft, and confirm", async () => {
      const h = harnessForStatus(() => "active");
      await seedOnHand(h, OPEN_SKU, 10, "active-flow-seed");

      const staffDraft = await h.createStaffDraft(OPEN_PRODUCT_ID, 2);
      expect(staffDraft.ok).toBe(true);

      const wholesaleDraft = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 1);
      expect(wholesaleDraft.ok).toBe(true);
      if (!wholesaleDraft.ok) {
        return;
      }

      const confirmed = await h.confirm.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        salesOrderId: wholesaleDraft.salesOrderId,
        idempotencyKey: "active-confirm",
        shipToId: h.shipToId,
      });
      expect(confirmed.ok).toBe(true);
      if (!confirmed.ok) {
        return;
      }
      expect(confirmed.salesOrder.status).toBe("confirmed");
    });
  });
});
