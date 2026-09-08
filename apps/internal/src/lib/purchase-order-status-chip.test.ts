import { describe, expect, it } from "vitest";
import {
  purchaseOrderStatusLabel,
  purchaseOrderStatusPresentation,
} from "./purchase-order-status-chip";
import { purchaseOrderStatusFilterOptions } from "./purchase-order-status-filter";

describe("purchaseOrderStatusPresentation", () => {
  it("maps every list-filter status to its Title Case label", () => {
    for (const option of purchaseOrderStatusFilterOptions) {
      const presentation = purchaseOrderStatusPresentation(option.value);
      expect(presentation).not.toBeNull();
      expect(presentation?.label).toBe(option.label);
    }
  });

  it("labels confirmed purchase orders as Issued", () => {
    expect(purchaseOrderStatusPresentation("confirmed")).toEqual({
      label: "Issued",
      color: "var(--color-info)",
    });
    expect(purchaseOrderStatusLabel("confirmed")).toBe("Issued");
  });
});
