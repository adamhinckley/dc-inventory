import { describe, expect, it } from "vitest";
import { purchaseOrderLineRemainingQty } from "./purchase-order-line-remaining-qty";

describe("purchaseOrderLineRemainingQty", () => {
  it("returns ordered minus received", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 10, receivedQty: 3 })).toBe(7);
  });

  it("returns zero when fully received", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 4, receivedQty: 4 })).toBe(0);
  });

  it("returns full qty when nothing received yet", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 12, receivedQty: 0 })).toBe(12);
  });
});
