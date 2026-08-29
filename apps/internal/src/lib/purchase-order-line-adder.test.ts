import { describe, expect, it } from "vitest";
import { draftLineFromVendorProduct } from "./purchase-order-line-adder";

describe("draftLineFromVendorProduct", () => {
  it("builds a qty-1 line from a vendor catalog product", () => {
    const line = draftLineFromVendorProduct({
      sku: "DC7818LV",
      catalogName: 'Baby Rose Bush X 7 12" - Lavender',
    });
    expect(line).toMatchObject({
      sku: "DC7818LV",
      name: 'Baby Rose Bush X 7 12" - Lavender',
      qty: 1,
    });
    expect(line.id).toEqual(expect.any(String));
  });
});
