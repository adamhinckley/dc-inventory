import { describe, expect, it } from "vitest";
import {
  casesForDraftPoQty,
  draftLineFromVendorProduct,
  suggestedDraftPoQty,
} from "./purchase-order-line-adder";

describe("suggestedDraftPoQty", () => {
  it("ceils need to the next master pack (584 units, 100 per case → 600)", () => {
    expect(suggestedDraftPoQty(584, 100)).toBe(600);
  });

  it("starts at qty 1 when there is no need", () => {
    expect(suggestedDraftPoQty(0, 12)).toBe(1);
  });

  it("uses raw need when case qty is missing", () => {
    expect(suggestedDraftPoQty(40, null)).toBe(40);
  });
});

describe("casesForDraftPoQty", () => {
  it("shows six cases for 600 units at 100 per case", () => {
    expect(casesForDraftPoQty(600, 100)).toBe(6);
  });

  it("leaves cases blank without case qty", () => {
    expect(casesForDraftPoQty(40, null)).toBeNull();
  });
});

describe("draftLineFromVendorProduct", () => {
  it("covers uncovered need rounded up to a master pack", () => {
    const line = draftLineFromVendorProduct({
      sku: "DC7818LV",
      catalogName: 'Baby Rose Bush X 7 12" - Lavender',
      caseQty: 100,
      qty: { uncovered: 584 },
    });
    expect(line.qty).toBe(600);

    const second = draftLineFromVendorProduct({
      sku: "DC7819LV",
      catalogName: "Different rose",
    });
    expect(second.qty).toBe(1);
    expect(second.id).not.toBe(line.id);
  });
});
