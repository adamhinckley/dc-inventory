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
    expect(issuePurchaseOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toBe(
      "This purchase order could not be issued due to a conflict.",
    );
    expect(unissuePurchaseOrderErrorMessage({ status: 409, data: { error: "conflict" } })).toBe(
      "This purchase order could not be unissued because receiving has started.",
    );
  });
});
