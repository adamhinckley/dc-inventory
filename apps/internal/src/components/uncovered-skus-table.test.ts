import { describe, expect, it } from "vitest";
import {
  afterDraftUncoveredPos,
  formatUnmappedSkusNotice,
  shouldDraftUncoveredSelection,
} from "../lib/uncovered-draft-workflow";

describe("uncovered draft workflow", () => {
  it("does not draft when selection is empty", () => {
    expect(shouldDraftUncoveredSelection(0)).toBe(false);
    expect(shouldDraftUncoveredSelection(2)).toBe(true);
  });

  it("stays on the worksheet with a notice when every selected SKU is unmapped", () => {
    const next = afterDraftUncoveredPos([], ["SKU-X", "SKU-Y"]);
    expect(next).toEqual({
      action: "stay",
      unmappedNotice:
        "Skipped 2 SKU(s) with no vendor mapping: SKU-X, SKU-Y",
    });
  });

  it("stays on the worksheet with a notice when the selection mixes mapped and unmapped SKUs", () => {
    const next = afterDraftUncoveredPos(
      [{ id: "po-1" }],
      ["SKU-X"],
    );
    expect(next).toEqual({
      action: "stay",
      unmappedNotice: "Skipped 1 SKU(s) with no vendor mapping: SKU-X",
    });
  });

  it("navigates to the first draft PO when every selected SKU mapped", () => {
    const next = afterDraftUncoveredPos(
      [{ id: "po-1" }, { id: "po-2" }],
      [],
    );
    expect(next).toEqual({
      action: "navigate",
      purchaseOrderId: "po-1",
    });
  });

  it("formats the skipped SKU list for staff", () => {
    expect(formatUnmappedSkusNotice([])).toBeNull();
    expect(formatUnmappedSkusNotice(["A", "B"])).toBe(
      "Skipped 2 SKU(s) with no vendor mapping: A, B",
    );
  });
});
