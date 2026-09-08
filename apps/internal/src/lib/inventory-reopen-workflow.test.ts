import { describe, expect, it, vi } from "vitest";
import {
  buildInventoryReopenCommand,
  buildSellWindowOpenCommand,
  enrichSellWindowSkuRows,
  fetchInventoryMatchPages,
  fetchRemainingInventoryMatches,
  filterSnapshotToListParams,
  instantToDateInput,
  INVENTORY_MATCH_PAGE_SIZE,
  isEligibleForSellWindowApply,
  listAllInternalSellWindows,
  listParamsToFilterSnapshot,
  type InventoryMatchListFn,
  parseOptionalWindowInstant,
  sellWindowReadOnly,
  shouldPrefetchInventoryMatches,
  type SellWindowListFn,
} from "./inventory-reopen-workflow";

const sampleRow = {
  sku: "STYLE-A",
  name: "Style A",
  supplierName: "Acme Supply",
  sellState: "locked",
  onHand: 4,
  onOrder: 0,
  inactive: false,
  discontinued: false,
};

describe("inventory reopen workflow", () => {
  it("maps blank window dates to null instants", () => {
    expect(parseOptionalWindowInstant("")).toBeNull();
    expect(parseOptionalWindowInstant("2027-01-15")).toBe(
      new Date(2027, 0, 15).toISOString(),
    );
  });

  it("formats instants for DateInput using local calendar days", () => {
    expect(instantToDateInput(new Date(2027, 0, 15).toISOString())).toBe("2027-01-15");
    expect(instantToDateInput(null)).toBe("");
  });

  it("round-trips local DateInput values through parse and format", () => {
    expect(instantToDateInput(parseOptionalWindowInstant("2029-08-20"))).toBe("2029-08-20");
  });

  it("round-trips filter snapshots through list params", () => {
    expect(
      listParamsToFilterSnapshot({
        q: "hat",
        category: ["Hats"],
        supplierId: ["00000000-0000-0000-0000-000000000001"],
        excludeSupplierId: ["00000000-0000-0000-0000-000000000002"],
      }),
    ).toEqual({
      q: "hat",
      category: ["Hats"],
      supplierId: ["00000000-0000-0000-0000-000000000001"],
      excludeSupplierId: ["00000000-0000-0000-0000-000000000002"],
    });
    expect(
      filterSnapshotToListParams({
        q: "hat",
        category: ["Hats"],
      }),
    ).toEqual({
      q: "hat",
      category: ["Hats"],
    });
  });

  it("skips inactive and discontinued rows for bulk apply", () => {
    expect(isEligibleForSellWindowApply(sampleRow)).toBe(true);
    expect(isEligibleForSellWindowApply({ ...sampleRow, inactive: true })).toBe(false);
    expect(isEligibleForSellWindowApply({ ...sampleRow, discontinued: true })).toBe(false);
  });

  it("builds a reopen command for eligible filtered matches", () => {
    expect(
      buildInventoryReopenCommand(
        [
          sampleRow,
          {
            sku: "STYLE-B",
            name: "Style B",
            supplierName: null,
            sellState: "locked",
            onHand: 0,
            onOrder: 12,
            inactive: true,
            discontinued: false,
          },
        ],
        "2027-01-15",
        "2027-02-15",
        { q: "hat" },
        "Spring Hats",
      ),
    ).toEqual({
      name: "Spring Hats",
      filterSnapshot: { q: "hat" },
      skus: ["STYLE-A"],
      windowOpensAt: new Date(2027, 0, 15).toISOString(),
      windowClosesAt: new Date(2027, 1, 15).toISOString(),
    });
  });

  it("builds an open command from checked SKUs", () => {
    expect(
      buildSellWindowOpenCommand({
        name: "Spring Hats",
        filterParams: { category: ["Hats"] },
        checkedSkus: ["STYLE-A", "STYLE-B"],
        opensAt: "2027-01-15",
        closesAt: "2029-06-01",
      }),
    ).toEqual({
      name: "Spring Hats",
      filterSnapshot: { category: ["Hats"] },
      skus: ["STYLE-A", "STYLE-B"],
      windowOpensAt: new Date(2027, 0, 15).toISOString(),
      windowClosesAt: new Date(2029, 5, 1).toISOString(),
    });
  });

  it("requires a close date when building the reopen command", () => {
    expect(() =>
      buildInventoryReopenCommand([sampleRow], "", "", {}, "Spring Hats"),
    ).toThrow("window close date is required");
  });

  it("marks manually closed windows read-only", () => {
    expect(sellWindowReadOnly({ status: "open", manuallyClosedAt: null })).toBe(false);
    expect(
      sellWindowReadOnly({
        status: "open",
        manuallyClosedAt: new Date(2027, 0, 1).toISOString(),
      }),
    ).toBe(true);
    expect(sellWindowReadOnly({ status: "closed", manuallyClosedAt: null })).toBe(true);
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
              inactive: false,
              discontinued: false,
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
            inactive: false,
            discontinued: false,
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
      "Sell Window",
    );

    expect(initial.items).toHaveLength(500);
    expect(remaining.length).toBe(total - initial.items.length);
    expect(command.skus).toHaveLength(total);
    expect(command.skus[0]).toBe("SKU-1");
    expect(command.skus.at(-1)).toBe(`SKU-${total}`);
    expect(command.windowOpensAt).toBe(new Date(2027, 0, 15).toISOString());
    expect(command.windowClosesAt).toBe(new Date(2027, 1, 15).toISOString());
  });

  it("loads every sell window page until total is covered", async () => {
    const listWindowsMock = vi.fn(async (params: { page?: number; pageSize?: number }) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 100;
      return {
        status: 200 as const,
        data: {
          items: [
            {
              id: `window-${page}`,
              name: `Window ${page}`,
              filterSnapshot: {},
              windowOpensAt: null,
              windowClosesAt: "2027-08-01T00:00:00.000Z",
              status: "open" as const,
              manuallyClosedAt: null,
              appliedBy: "11111111-1111-4111-8111-111111111111",
              appliedAt: "2027-01-01T00:00:00.000Z",
              skuCount: 1,
              createdAt: "2027-01-01T00:00:00.000Z",
              updatedAt: "2027-01-01T00:00:00.000Z",
            },
          ],
          page,
          pageSize,
          total: 150,
        },
      };
    });
    const listWindows = listWindowsMock as unknown as SellWindowListFn;

    const result = await listAllInternalSellWindows(listWindows);

    expect(listWindowsMock.mock.calls.map((call) => call[0]?.page)).toEqual([1, 2]);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(150);
  });

  it("enriches saved window SKUs by membership with per-sku lookup fallback", async () => {
    const listProductsMock = vi.fn(async (params: { q?: string; page?: number }) => {
      if (params.q === "MISSING-SKU") {
        return {
          status: 200 as const,
          data: {
            items: [
              {
                sku: "MISSING-SKU",
                name: "Missing Style",
                supplierName: "Acme Supply",
                sellState: "locked",
                onHand: 3,
                onOrder: 0,
                inactive: false,
                discontinued: false,
              },
            ],
            total: 1,
            page: 1,
            pageSize: INVENTORY_MATCH_PAGE_SIZE,
          },
        };
      }
      return {
        status: 200 as const,
        data: {
          items: [
            {
              sku: "STYLE-A",
              name: "Style A",
              supplierName: "Acme Supply",
              sellState: "locked",
              onHand: 4,
              onOrder: 0,
              inactive: false,
              discontinued: false,
            },
          ],
          total: 1,
          page: params.page ?? 1,
          pageSize: INVENTORY_MATCH_PAGE_SIZE,
        },
      };
    });
    const listProducts = listProductsMock as unknown as InventoryMatchListFn;

    const rows = await enrichSellWindowSkuRows(
      ["STYLE-A", "MISSING-SKU"],
      { category: ["Hats"] },
      listProducts,
    );

    expect(rows).toEqual([
      {
        sku: "STYLE-A",
        name: "Style A",
        supplierName: "Acme Supply",
        sellState: "locked",
        onHand: 4,
        onOrder: 0,
        inactive: false,
        discontinued: false,
      },
      {
        sku: "MISSING-SKU",
        name: "Missing Style",
        supplierName: "Acme Supply",
        sellState: "locked",
        onHand: 3,
        onOrder: 0,
        inactive: false,
        discontinued: false,
      },
    ]);
  });
});
