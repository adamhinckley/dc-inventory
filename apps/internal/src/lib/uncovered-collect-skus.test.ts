import { describe, expect, it, vi } from "vitest";
import { collectUncoveredSkusForFactories } from "./uncovered-collect-skus";

describe("collectUncoveredSkusForFactories", () => {
  it("throws when a SKU page request fails instead of returning a partial list", async () => {
    const listSkus = vi.fn(async () => ({
      status: 403 as const,
      data: { error: "forbidden" as const },
    }));

    await expect(
      collectUncoveredSkusForFactories(
        ["factory-a"],
        listSkus as unknown as Parameters<typeof collectUncoveredSkusForFactories>[1],
      ),
    ).rejects.toThrow("Could not load uncovered SKUs.");
  });
});
