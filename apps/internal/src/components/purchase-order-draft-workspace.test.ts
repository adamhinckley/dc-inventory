import { describe, expect, it } from "vitest";
import { draftIssueDisabled } from "./purchase-order-draft-workspace";

describe("PurchaseOrderDraftWorkspace interface", () => {
  const saved = [{ sku: "DEM-00003", name: "Connector", qty: 3 }];
  const dirty = [{ sku: "DEM-00003", name: "Connector", qty: 4 }];

  it("blocks issue while autosave is in flight or lines are dirty", () => {
    expect(draftIssueDisabled(saved, saved, "idle", false, false)).toBe(false);
    expect(draftIssueDisabled(dirty, saved, "idle", false, false)).toBe(true);
    expect(draftIssueDisabled(saved, saved, "saving", false, false)).toBe(true);
    expect(draftIssueDisabled(saved, saved, "idle", true, false)).toBe(true);
    expect(draftIssueDisabled(saved, saved, "idle", false, true)).toBe(true);
    expect(draftIssueDisabled([], saved, "idle", false, false)).toBe(true);
  });
});
