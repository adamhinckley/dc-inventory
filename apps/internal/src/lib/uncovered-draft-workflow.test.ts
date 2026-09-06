import { describe, expect, it } from "vitest";
import {
  afterDraftUncoveredPos,
  formatUnmappedSkusNotice,
  shouldDraftUncoveredSelection,
  toUncoveredBatchDraftRows,
} from "./uncovered-draft-workflow";

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
        "Skipped 2 SKU(s) with no factory mapping: SKU-X, SKU-Y",
    });
  });

  it("opens the batch modal when multiple drafts are created", () => {
    const supplierNames = new Map([
      ["supplier-a", "Factory A"],
      ["supplier-b", "Factory B"],
    ]);
    const next = afterDraftUncoveredPos(
      [
        {
          id: "po-1",
          supplierId: "supplier-a",
          documentNumber: "PO-0001",
          lines: [{}, {}],
        },
        {
          id: "po-2",
          supplierId: "supplier-b",
          documentNumber: "PO-0002",
          lines: [{}],
        },
      ],
      [],
      supplierNames,
    );
    expect(next).toEqual({
      action: "modal",
      drafts: [
        {
          purchaseOrderId: "po-1",
          documentNumber: "PO-0001",
          supplierId: "supplier-a",
          supplierName: "Factory A",
          lineCount: 2,
        },
        {
          purchaseOrderId: "po-2",
          documentNumber: "PO-0002",
          supplierId: "supplier-b",
          supplierName: "Factory B",
          lineCount: 1,
        },
      ],
      unmappedNotice: null,
    });
  });

  it("opens the batch modal when one draft is created but some SKUs were skipped", () => {
    const next = afterDraftUncoveredPos(
      [
        {
          id: "po-1",
          supplierId: "supplier-a",
          documentNumber: "PO-0001",
          lines: [{}],
        },
      ],
      ["SKU-X"],
      new Map([["supplier-a", "Factory A"]]),
    );
    expect(next.action).toBe("modal");
    if (next.action !== "modal") {
      throw new Error("expected modal");
    }
    expect(next.drafts).toHaveLength(1);
    expect(next.unmappedNotice).toBe(
      "Skipped 1 SKU(s) with no factory mapping: SKU-X",
    );
  });

  it("navigates to the draft PO workspace when exactly one draft is created with no skips", () => {
    const next = afterDraftUncoveredPos([{ id: "po-1", supplierId: "supplier-a", documentNumber: "PO-0001", lines: [{}] }], []);
    expect(next).toEqual({
      action: "navigate",
      purchaseOrderId: "po-1",
    });
  });

  it("formats the skipped SKU list for staff", () => {
    expect(formatUnmappedSkusNotice([])).toBeNull();
    expect(formatUnmappedSkusNotice(["A", "B"])).toBe(
      "Skipped 2 SKU(s) with no factory mapping: A, B",
    );
  });

  it("falls back to supplier id when a factory name is unknown", () => {
    const rows = toUncoveredBatchDraftRows(
      [
        {
          id: "po-1",
          supplierId: "supplier-a",
          documentNumber: "PO-0001",
          lines: [{}],
        },
      ],
      new Map(),
    );
    expect(rows[0]?.supplierName).toBe("supplier-a");
  });
});
