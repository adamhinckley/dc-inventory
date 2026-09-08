import { describe, expect, it, vi } from "vitest";
import {
  buildInventoryReopenCommand,
  fetchInventoryMatchPages,
  fetchRemainingInventoryMatches,
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
        "2027-02-15",
        { q: "hat" },
      ),
    ).toEqual({
      name: "Manage Pre-Sell",
      filterSnapshot: { q: "hat" },
      skus: ["STYLE-A", "STYLE-B"],
      windowOpensAt: new Date(2027, 0, 15).toISOString(),
      windowClosesAt: new Date(2027, 1, 15).toISOString(),
    });
  });

  it("requires a close date when building the reopen command", () => {
    expect(() =>
      buildInventoryReopenCommand(
        [
          {
            sku: "STYLE-A",
            name: "Style A",
            supplierName: null,
            sellState: "locked",
            onHand: 0,
            onOrder: 0,
          },
        ],
        "",
        "",
        {},
      ),
    ).toThrow("window close date is required");
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

  it("concatenates remaining page windows into the reopen command", async () => {
    const total = 900;
    const listProductsMock = vi.fn(async (params: { page?: number; pageSize?: number }) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? INVENTORY_MATCH_PAGE_SIZE;
      const startSku = (page - 1) * pageSize + 1;
      const count = Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize));
      return {
        status: 200 as const,
        data: {
          items: Array.from({ length: count }, (_, index) => ({
            sku: `SKU-${startSku + index}`,
            name: `Style ${startSku + index}`,
            supplierName: "Acme Supply",
            sellState: "locked",
            onHand: 0,
            onOrder: 1,
          })),
          total,
          page,
          pageSize,
        },
      };
    });
    const listProducts = listProductsMock as unknown as InventoryMatchListFn;

    const initial = await fetchInventoryMatchPages({}, 1, 5, listProducts);
    const remaining = await fetchRemainingInventoryMatches({}, initial.nextPage ?? 1, listProducts);
    const command = buildInventoryReopenCommand(
      [...initial.items, ...remaining],
      "2027-01-15",
      "2027-02-15",
      {},
    );

    expect(initial.items).toHaveLength(500);
    expect(remaining.length).toBe(total - initial.items.length);
    expect(command.skus).toHaveLength(total);
    expect(command.skus[0]).toBe("SKU-1");
    expect(command.skus.at(-1)).toBe(`SKU-${total}`);
    expect(command.windowOpensAt).toBe(new Date(2027, 0, 15).toISOString());
    expect(command.windowClosesAt).toBe(new Date(2027, 1, 15).toISOString());
  });
});
