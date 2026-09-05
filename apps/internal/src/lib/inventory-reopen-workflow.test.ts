import { describe, expect, it, vi } from "vitest";
import {
  buildInventoryReopenCommand,
  fetchInventoryMatchPages,
  INVENTORY_MATCH_PAGE_SIZE,
  type InventoryMatchListFn,
  parseOptionalWindowInstant,
  shouldPrefetchInventoryMatches,
} from "./inventory-reopen-workflow";

describe("inventory reopen workflow", () => {
  it("maps blank window dates to null instants", () => {
    expect(parseOptionalWindowInstant("")).toBeNull();
    expect(parseOptionalWindowInstant("2027-01-15")).toBe(
      new Date(2027, 0, 15).toISOString(),
    );
  });

  it("builds a reopen command for the full filtered match set", () => {
    expect(
      buildInventoryReopenCommand(
        [
          {
            sku: "STYLE-A",
            name: "Style A",
            supplierName: "Acme Supply",
            sellState: "locked",
            onHand: 4,
            onOrder: 0,
          },
          {
            sku: "STYLE-B",
            name: "Style B",
            supplierName: null,
            sellState: "locked",
            onHand: 0,
            onOrder: 12,
          },
        ],
        "2027-01-15",
        "",
      ),
    ).toEqual({
      skus: ["STYLE-A", "STYLE-B"],
      windowOpensAt: new Date(2027, 0, 15).toISOString(),
      windowClosesAt: null,
    });
  });

  it("prefetches when the scroller reaches the third page of a five-page window", () => {
    expect(
      shouldPrefetchInventoryMatches({
        loadedCount: 500,
        total: 2_000,
        visibleIndex: 200,
      }),
    ).toBe(true);
    expect(
      shouldPrefetchInventoryMatches({
        loadedCount: 500,
        total: 2_000,
        visibleIndex: 199,
      }),
    ).toBe(false);
    expect(
      shouldPrefetchInventoryMatches({
        loadedCount: 500,
        total: 500,
        visibleIndex: 400,
      }),
    ).toBe(false);
  });

  it("loads only the requested page window and reports the next page", async () => {
    const listProductsMock = vi.fn(async (params: { page?: number; pageSize?: number }) => {
      const page = params.page ?? 1;
      return {
        status: 200 as const,
        data: {
          items: [
            {
              sku: `SKU-${page}`,
              name: `Style ${page}`,
              supplierName: "Acme Supply",
              sellState: "locked",
              onHand: 0,
              onOrder: 1,
            },
          ],
          total: 900,
          page,
          pageSize: INVENTORY_MATCH_PAGE_SIZE,
        },
      };
    });
    const listProducts = listProductsMock as unknown as InventoryMatchListFn;

    const first = await fetchInventoryMatchPages({}, 1, 5, listProducts);
    expect(listProductsMock.mock.calls.map((call) => call[0]?.page)).toEqual([1, 2, 3, 4, 5]);
    expect(first.items.map((row) => row.sku)).toEqual([
      "SKU-1",
      "SKU-2",
      "SKU-3",
      "SKU-4",
      "SKU-5",
    ]);
    expect(first.total).toBe(900);
    expect(first.nextPage).toBe(6);

    const second = await fetchInventoryMatchPages({}, 6, 5, listProducts);
    expect(second.nextPage).toBe(11);
  });
});
