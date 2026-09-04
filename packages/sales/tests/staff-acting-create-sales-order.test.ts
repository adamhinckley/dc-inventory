import type { AccountStatus } from "@dc-inventory/customers";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ID,
  DEFAULT_ORG,
  OPEN_PRODUCT_ID,
  salesDemandHarness,
  STAFF_ID,
} from "./support/sales-demand-harness.js";

function harnessForStatus(getAccountStatus: () => AccountStatus) {
  return salesDemandHarness(undefined, { getAccountStatus });
}

describe("staff acting wholesale create (ADA-272)", () => {
  it("persists placedByStaffUserId on draft create", async () => {
    const h = harnessForStatus(() => "active");

    const result = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, result.salesOrderId);
    expect(reloaded?.placedByStaffUserId).toBe(STAFF_ID);
    expect(reloaded?.status).toBe("draft");
  });

  it("uses wholesale draft gates: allows on-hold customer", async () => {
    const h = harnessForStatus(() => "on_hold");

    const result = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, result.salesOrderId);
    expect(reloaded?.placedByStaffUserId).toBe(STAFF_ID);
    expect(reloaded?.status).toBe("draft");
  });

  it("uses wholesale draft gates: blocks inactive customer", async () => {
    const h = harnessForStatus(() => "inactive");

    const result = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 1);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("customer_inactive");
  });

  it("does not treat placedByStaffUserId as internal staff place-on-behalf", async () => {
    const h = harnessForStatus(() => "on_hold");

    const staffResult = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
    expect(staffResult.ok).toBe(false);
    if (staffResult.ok) {
      return;
    }
    expect(staffResult.reason).toBe("customer_on_hold");

    const actingResult = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 1);
    expect(actingResult.ok).toBe(true);
  });
});
