import { describe, expect, it } from "vitest";
import {
  COVER_PRODUCT_ID,
  CUSTOMER_ID,
  DEFAULT_ORG,
  OPEN_PRODUCT_ID,
  salesDemandHarness,
  STAFF_ID,
} from "./support/sales-demand-harness.js";

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

    h.creditCheck.setAvailableCredit(DEFAULT_ORG, CUSTOMER_ID, 0);

    const result = await h.confirm.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      salesOrderId: draft.salesOrderId,
      idempotencyKey: "credit-zero",
      shipToId: h.shipToId,
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
});
