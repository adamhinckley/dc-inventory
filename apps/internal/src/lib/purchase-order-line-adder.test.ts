import { describe, expect, it } from "vitest";
import { lineAdderSelectionForSupplier } from "./purchase-order-line-adder";

describe("lineAdderSelectionForSupplier", () => {
  it("clears selected SKUs and error when the vendor changes", () => {
    expect(lineAdderSelectionForSupplier("vendor-a", "vendor-b")).toEqual({
      selectedSkus: [],
      error: null,
    });
  });

  it("keeps the current selection when the vendor is unchanged", () => {
    expect(lineAdderSelectionForSupplier("vendor-a", "vendor-a")).toBeUndefined();
  });
});
