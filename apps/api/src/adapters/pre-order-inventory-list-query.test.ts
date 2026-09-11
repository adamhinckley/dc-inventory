import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPreOrderListQueryPgliteHarness,
  preOrderListQueryPgliteIds,
} from "./support/pre-order-list-query-pglite.js";

describe("PreOrderInventoryListQuery (Drizzle / PGlite)", () => {
  let harness: Awaited<ReturnType<typeof createPreOrderListQueryPgliteHarness>>;

  beforeAll(async () => {
    harness = await createPreOrderListQueryPgliteHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("filters toOrder SKUs by supplierId in SQL", async () => {
    const result = await harness.preOrderList.list({
      organizationId: preOrderListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      supplierId: preOrderListQueryPgliteIds.supplierA,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.sku).toEqual(preOrderListQueryPgliteIds.skuA);
    expect(result.items[0]?.toOrder).toBe(120);
  });

  it("filters toOrder SKUs by needsMapping in SQL", async () => {
    const result = await harness.preOrderList.list({
      organizationId: preOrderListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      needsMapping: true,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.sku).toEqual(preOrderListQueryPgliteIds.skuUnmapped);
  });

  it("rolls up factories with GROUP BY and paginates in SQL", async () => {
    const result = await harness.preOrderList.listFactories({
      organizationId: preOrderListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
    });

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      {
        supplierId: preOrderListQueryPgliteIds.supplierA,
        productCount: 1,
        totalToOrderUnits: 120,
        needsMapping: false,
      },
      {
        supplierId: preOrderListQueryPgliteIds.supplierB,
        productCount: 1,
        totalToOrderUnits: 40,
        needsMapping: false,
      },
      {
        supplierId: null,
        productCount: 1,
        totalToOrderUnits: 25,
        needsMapping: true,
      },
    ]);
  });

  it("excludes suppliers with open draft POs when requested", async () => {
    const result = await harness.preOrderList.listFactories({
      organizationId: preOrderListQueryPgliteIds.org,
      page: 1,
      pageSize: 25,
      excludeSuppliersWithOpenDraft: true,
    });

    expect(result.total).toBe(2);
    expect(result.items.map((row) => row.supplierId)).toEqual([
      preOrderListQueryPgliteIds.supplierB,
      null,
    ]);
  });
});
