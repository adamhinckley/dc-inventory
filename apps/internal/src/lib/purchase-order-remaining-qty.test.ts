import { describe, expect, it } from "vitest";
import { purchaseOrderRemainingQty } from "./purchase-order-remaining-qty";

describe("purchaseOrderRemainingQty", () => {
  it("sums qty minus receivedQty across lines", () => {
    expect(
      purchaseOrderRemainingQty([
        { qty: 10, receivedQty: 3 },
        { qty: 5, receivedQty: 0 },
      ]),
    ).toBe(12);
  });

  it("returns zero for fully received lines", () => {
    expect(
      purchaseOrderRemainingQty([
        { qty: 4, receivedQty: 4 },
        { qty: 2, receivedQty: 2 },
      ]),
    ).toBe(0);
  });

  it("returns zero for an empty line list", () => {
    expect(purchaseOrderRemainingQty([])).toBe(0);
  });
});
