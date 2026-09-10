import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createUncoveredListQueryPgliteHarness,
  uncoveredListQueryPgliteIds,
} from "./support/uncovered-list-query-pglite.js";

describe("UncoveredInventoryListQuery (Drizzle / PGlite)", () => {
  let harness: Awaited<ReturnType<typeof createUncoveredListQueryPgliteHarness>>;

  beforeAll(async () => {
    harness = await createUncoveredListQueryPgliteHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("filters uncovered SKUs by supplierId in SQL", async () => {
    const result = await harness.uncoveredList.list({
      organizationId: uncoveredListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      supplierId: uncoveredListQueryPgliteIds.supplierA,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.sku).toEqual(uncoveredListQueryPgliteIds.skuA);
    expect(result.items[0]?.uncovered).toBe(120);
  });

  it("filters uncovered SKUs by needsMapping in SQL", async () => {
    const result = await harness.uncoveredList.list({
      organizationId: uncoveredListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      needsMapping: true,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.sku).toEqual(uncoveredListQueryPgliteIds.skuUnmapped);
  });

  it("rolls up factories with GROUP BY and paginates in SQL", async () => {
    const result = await harness.uncoveredList.listFactories({
      organizationId: uncoveredListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
    });

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      {
        supplierId: uncoveredListQueryPgliteIds.supplierA,
        productCount: 1,
        totalUncoveredUnits: 120,
        needsMapping: false,
      },
      {
        supplierId: uncoveredListQueryPgliteIds.supplierB,
        productCount: 1,
        totalUncoveredUnits: 40,
        needsMapping: false,
      },
      {
        supplierId: null,
        productCount: 1,
        totalUncoveredUnits: 25,
        needsMapping: true,
      },
    ]);
  });

  it("excludes suppliers with open draft POs when requested", async () => {
    const result = await harness.uncoveredList.listFactories({
      organizationId: uncoveredListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      excludeSuppliersWithOpenDraft: true,
    });

    expect(result.total).toBe(2);
    expect(result.items.map((row) => row.supplierId)).toEqual([
      uncoveredListQueryPgliteIds.supplierB,
      null,
    ]);
  });
});
