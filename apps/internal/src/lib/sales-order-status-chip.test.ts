import { describe, expect, it } from "vitest";
import { salesOrderStatusPresentation } from "./sales-order-status-chip";
import { salesOrderStatusFilterOptions } from "./sales-order-status-filter";

describe("salesOrderStatusPresentation", () => {
  it("maps every list-filter status to its Title Case label", () => {
    for (const option of salesOrderStatusFilterOptions) {
      expect(salesOrderStatusPresentation(option.value)?.label).toBe(option.label);
    }
  });

  it("returns null for an unknown or empty status", () => {
    expect(salesOrderStatusPresentation("on_hold")).toBeNull();
    expect(salesOrderStatusPresentation(null)).toBeNull();
  });
});
