import { describe, expect, it } from "vitest";
import { purchasing2TabHref } from "./purchasing-2-workspace";

describe("purchasing2TabHref", () => {
  it("carries the current list query onto the sibling tab", () => {
    expect(
      purchasing2TabHref("/procurement/purchase-orders", "q=ornament&status=draft"),
    ).toBe("/procurement/purchase-orders?q=ornament&status=draft");
  });

  it("stays a bare path when the list query is empty", () => {
    expect(purchasing2TabHref("/procurement", "")).toBe("/procurement");
  });
});
