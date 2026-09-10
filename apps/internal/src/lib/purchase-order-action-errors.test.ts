import { describe, expect, it } from "vitest";
import {
  cancelPurchaseOrderErrorMessage,
  createPurchaseOrderErrorMessage,
  issuePurchaseOrderErrorMessage,
  unissuePurchaseOrderErrorMessage,
} from "./purchase-order-action-errors";

describe("purchase-order action errors", () => {
  it("maps create and issue conflicts", () => {
    expect(
      createPurchaseOrderErrorMessage({ status: 404, data: { error: "not_found" } }),
    ).toBe("Could not create draft purchase order because the vendor was not found.");
    expect(createPurchaseOrderErrorMessage({ status: 400 })).toBe(
      "Could not create draft purchase order.",
    );
    expect(
      issuePurchaseOrderErrorMessage({ status: 409, data: { error: "illegal_transition" } }),
    ).toBe("This purchase order is not a draft, so it cannot be issued.");
    expect(
      issuePurchaseOrderErrorMessage({ status: 409, data: { error: "product_not_found" } }),
    ).toBe("A product on this purchase order is missing from the catalog.");
    expect(
      issuePurchaseOrderErrorMessage({
        status: 409,
        data: {
          error: "provenance_conflict",
          sku: "DC30TDWH",
          name: '30" Mixed Pine Teardrop 90T - White (6/6)  *DIP_Item*',
        },
      }),
    ).toBe(
      '30" Mixed Pine Teardrop 90T - White (6/6)  *DIP_Item* already has inbound from a previous issue of this purchase order. Create a new PO to issue these lines again.',
    );
    expect(
      issuePurchaseOrderErrorMessage({ status: 409, data: { error: "invalid_quantity" } }),
    ).toBe("A line on this purchase order has an invalid quantity and cannot be issued.");
    expect(
      issuePurchaseOrderErrorMessage({ status: 409, data: { error: "inventory_conflict" } }),
    ).toBe("Inventory could not record inbound for this purchase order. Refresh and try again.");
    expect(
      issuePurchaseOrderErrorMessage({
        status: 409,
        data: { error: "idempotency_conflict" },
      }),
    ).toBe("This issue request conflicts with a previous attempt. Refresh and try again.");
    expect(issuePurchaseOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toBe(
      "This purchase order could not be issued due to a conflict.",
    );
    expect(unissuePurchaseOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toBe(
      "This purchase order could not be unissued because receiving has started.",
    );
    expect(cancelPurchaseOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toBe(
      "This purchase order could not be cancelled due to a conflict.",
    );
    expect(cancelPurchaseOrderErrorMessage({ status: 404 })).toBe(
      "Cancel failed because the purchase order was not found.",
    );
    expect(cancelPurchaseOrderErrorMessage({ status: 500 })).toBe(
      "Could not cancel this purchase order.",
    );
  });
});
