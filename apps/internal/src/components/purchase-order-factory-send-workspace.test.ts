import { describe, expect, it } from "vitest";
import { shouldWarnBeforeFactorySendDownload } from "./purchase-order-workspace-shared";

describe("PurchaseOrderFactorySendWorkspace interface", () => {
  it("warns before download when factory send is ready and a SKU blocks cartons", () => {
    expect(shouldWarnBeforeFactorySendDownload(true, false, "DEM-00003")).toBe(true);
    expect(shouldWarnBeforeFactorySendDownload(true, false, null)).toBe(false);
    expect(shouldWarnBeforeFactorySendDownload(false, false, "DEM-00003")).toBe(false);
    expect(shouldWarnBeforeFactorySendDownload(true, true, "DEM-00003")).toBe(false);
  });
});
