import { describe, expect, it, vi } from "vitest";
import { collectPreOrderSkusForFactories } from "./uncovered-collect-skus";

describe("collectPreOrderSkusForFactories", () => {
  it("throws when a SKU page request fails instead of returning a partial list", async () => {
    const listSkus = vi.fn(async () => ({
      status: 403 as const,
      data: { error: "forbidden" as const },
    }));

    await expect(
      collectPreOrderSkusForFactories(
        ["factory-a"],
        listSkus as unknown as Parameters<typeof collectPreOrderSkusForFactories>[1],
      ),
    ).rejects.toThrow("Could not load toOrder SKUs.");
  });
});
