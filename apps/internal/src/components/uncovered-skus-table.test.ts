import { describe, expect, it } from "vitest";
import { suggestedDraftPoQty } from "../lib/purchase-order-line-math";

describe("uncovered worksheet draft selection", () => {
  it("uses suggestedDraftPoQty for draft line quantities", () => {
    expect(suggestedDraftPoQty(584, 100)).toBe(600);
    expect(suggestedDraftPoQty(120, 48)).toBe(144);
    expect(suggestedDraftPoQty(40, null)).toBe(40);
  });
});
