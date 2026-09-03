import { describe, expect, it } from "vitest";
import { draftFinalizeDisabled } from "./purchase-order-draft-workspace";

describe("PurchaseOrderDraftWorkspace interface", () => {
  const saved = [{ sku: "DEM-00003", name: "Connector", qty: 3 }];
  const dirty = [{ sku: "DEM-00003", name: "Connector", qty: 4 }];

  it("blocks finalize while autosave is in flight or lines are dirty", () => {
    expect(draftFinalizeDisabled(saved, saved, "idle", false, false)).toBe(false);
    expect(draftFinalizeDisabled(dirty, saved, "idle", false, false)).toBe(true);
    expect(draftFinalizeDisabled(saved, saved, "saving", false, false)).toBe(true);
    expect(draftFinalizeDisabled(saved, saved, "idle", true, false)).toBe(true);
    expect(draftFinalizeDisabled(saved, saved, "idle", false, true)).toBe(true);
    expect(draftFinalizeDisabled([], saved, "idle", false, false)).toBe(true);
  });
});
