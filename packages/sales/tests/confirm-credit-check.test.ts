import { describe, expect, it } from "vitest";
import { LimitExposureCreditCheckPort } from "../src/adapters/in-memory-credit-check.js";
import { ConfirmSalesOrderUseCase } from "../src/application/confirm-sales-order.js";
import type { ICustomerLookupPort } from "../src/domain/ports/sales-order-repository.js";
import { InMemoryCustomerShipToSnapshotReadPort } from "../src/adapters/in-memory-customer-ship-to-snapshot-read.js";
import {
  COVER_PRODUCT_ID,
  CUSTOMER_ID,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  LOCK_SKU,
  OPEN_PRODUCT_ID,
  PO_COVER,
  salesDemandHarness,
  seedStickyLockedOnHand,
  STAFF_ID,
} from "./support/sales-demand-harness.js";
import { seedTestShipTo, TEST_SHIP_TO_ID } from "./support/test-ship-to.js";

describe("Confirm sales order credit check (ADA-362)", () => {
  it("blocks confirm when available credit is below the order total", async () => {
    const h = salesDemandHarness();
    const draft = await h.createStaffDraft(OPEN_PRODUCT_ID, 2);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    h.creditCheck.setAvailableCredit(DEFAULT_ORG, CUSTOMER_ID, 500);

    const result = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "credit-block",
      shipToId: h.shipToId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("credit_exceeded");
    expect(result.availableCreditCents).toBe(500);
    expect(result.orderTotalCents).toBe(1000);
  });

  it("confirms when available credit exactly matches the order total", async () => {
    const h = salesDemandHarness();
    const draft = await h.createStaffDraft(OPEN_PRODUCT_ID, 2);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    h.creditCheck.setAvailableCredit(DEFAULT_ORG, CUSTOMER_ID, 1000);

    const result = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "credit-exact",
      shipToId: h.shipToId,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks any tab order when the customer has a $0 credit limit", async () => {
    const h = salesDemandHarness();
    const draft = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const shipToSnapshot = new InMemoryCustomerShipToSnapshotReadPort();
    seedTestShipTo(shipToSnapshot, CUSTOMER_ID);
    const customers: ICustomerLookupPort = {
      findById: async (organizationId, id) => {
        if (organizationId === DEFAULT_ORG && id === CUSTOMER_ID) {
          return { id, accountStatus: "active" };
        }
        return null;
      },
    };
    const confirm = new ConfirmSalesOrderUseCase(
      h.uow,
      customers,
      shipToSnapshot,
      new LimitExposureCreditCheckPort(0),
    );

    const result = await confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "credit-zero-limit",
      shipToId: TEST_SHIP_TO_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("credit_exceeded");
    expect(result.availableCreditCents).toBe(0);
    expect(result.orderTotalCents).toBe(500);
  });

  it("records staff override and confirms when overrideCredit is true", async () => {
    const h = salesDemandHarness();
    const draft = await h.createStaffDraft(COVER_PRODUCT_ID, 1);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    h.creditCheck.setAvailableCredit(DEFAULT_ORG, CUSTOMER_ID, 100);

    const result = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "credit-override",
      shipToId: h.shipToId,
      overrideCredit: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.salesOrder.status).toBe("confirmed");
    expect(result.salesOrder.creditLimitOverriddenByStaffUserId).toBe(STAFF_ID);
  });

  it("still fails ATP when overrideCredit is true but inventory is insufficient", async () => {
    const h = salesDemandHarness();
    await seedStickyLockedOnHand(h, LOCK_SKU, 400, PO_COVER, "override-atp-gate");

    const draft = await h.createStaffDraft(LOCK_PRODUCT_ID, 401);
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    h.creditCheck.setAvailableCredit(DEFAULT_ORG, CUSTOMER_ID, 0);

    const result = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "override-atp-fail",
      shipToId: h.shipToId,
      overrideCredit: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("insufficient_atp");
    expect(result.shortage).toEqual({
      sku: LOCK_SKU.value,
      name: "Locked presell widget",
      requestedQty: 401,
      availableQty: 400,
    });
  });
});
