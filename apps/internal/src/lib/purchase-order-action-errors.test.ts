import { describe, expect, it } from "vitest";
import {
  createPurchaseOrderErrorMessage,
  issuePurchaseOrderErrorMessage,
  unissuePurchaseOrderErrorMessage,
} from "./purchase-order-action-errors";

describe("purchase-order action errors", () => {
  it("explains missing vendor PO prefix on create", () => {
    expect(
      createPurchaseOrderErrorMessage({
        status: 409,
        data: { error: "supplier_po_prefix_missing" },
      }),
    ).toBe("Set a PO prefix on this vendor before creating a purchase order.");
  });

  it("maps issue and unissue conflicts", () => {
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
  });
});
