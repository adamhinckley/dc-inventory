import { describe, expect, it } from "vitest";
import { draftLineFromVendorProduct } from "./purchase-order-line-adder";

describe("draftLineFromVendorProduct", () => {
  it("starts picked vendor products at qty 1 with a fresh line id", () => {
    const line = draftLineFromVendorProduct({
      sku: "DC7818LV",
      catalogName: 'Baby Rose Bush X 7 12" - Lavender',
    });
    expect(line.qty).toBe(1);
    expect(line.id).toEqual(expect.any(String));

    const second = draftLineFromVendorProduct({
      sku: "DC7819LV",
      catalogName: "Different rose",
    });
    expect(second.id).not.toBe(line.id);
  });
});
