import { describe, expect, it } from "vitest";
import { inventoryTabHref } from "./inventory-workspace";

describe("inventoryTabHref", () => {
  it("carries the current list query onto the sibling tab", () => {
    expect(inventoryTabHref("/inventory/reopen", "q=ornament&hideZeroInventory=true")).toBe(
      "/inventory/reopen?q=ornament&hideZeroInventory=true",
    );
  });

  it("stays a bare path when the list query is empty", () => {
    expect(inventoryTabHref("/inventory", "")).toBe("/inventory");
  });
});
