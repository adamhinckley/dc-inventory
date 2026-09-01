import { describe, expect, it } from "vitest";
import type { SupplierProductRow } from "./supplier-product-types";
import {
  buildSupplierProductBySku,
  findExactSupplierProductInList,
  formatSupplierProductQtyDisplay,
  supplierProductFromListResponse,
  supplierProductLookupStatus,
} from "./supplier-product-by-sku";

function productRow(
  sku: string,
  qty: Partial<SupplierProductRow["qty"]> = {},
): SupplierProductRow {
  return {
    id: `prod-${sku}`,
    sku,
    catalogName: sku,
    supplierSku: null,
    minOrderQty: null,
    minOrderAmountCents: null,
    lastPoCostCents: null,
    currency: "USD",
    caseQty: 12,
    qty: {
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      uncovered: 0,
      ...qty,
    },
  };
}

describe("findExactSupplierProductInList", () => {
  it("matches SKU exactly when list q is a substring search", () => {
    const items = [
      productRow("DC7818", { onHand: 1 }),
      productRow("DC78180", { onHand: 2 }),
    ];
    expect(findExactSupplierProductInList(items, "DC7818")?.qty.onHand).toBe(1);
    expect(findExactSupplierProductInList(items, "DC78180")?.qty.onHand).toBe(2);
    expect(findExactSupplierProductInList(items, "DC7819")).toBeUndefined();
  });
});

describe("supplierProductFromListResponse", () => {
  it("hydrates a line SKU that is not on page 1 of the vendor list", () => {
    const pageOneItems = Array.from({ length: 100 }, (_, index) =>
      productRow(`PAGE1-${index}`, { onHand: 1 }),
    );
    const offPageSku = "OFF-PAGE-SKU";
    const pageOneMap = new Map(pageOneItems.map((item) => [item.sku, item]));
    expect(pageOneMap.get(offPageSku)?.qty.onHand ?? 0).toBe(0);

    const offPageResponse = {
      status: 200 as const,
      data: {
        items: [productRow(offPageSku, { onHand: 17, committed: 4, uncovered: 9 })],
        page: 1,
        pageSize: 100,
        total: 1,
      },
      headers: new Headers(),
    };
    const offPageProduct = supplierProductFromListResponse(offPageResponse, offPageSku);
    expect(offPageProduct?.qty.onHand).toBe(17);

    const merged = buildSupplierProductBySku(
      [offPageSku],
      [offPageProduct],
    );
    expect(merged.get(offPageSku)?.qty.onHand).toBe(17);
    expect(merged.get(offPageSku)?.qty.committed).toBe(4);
    expect(merged.get(offPageSku)?.qty.uncovered).toBe(9);
  });
});

describe("formatSupplierProductQtyDisplay", () => {
  it("distinguishes loading and missing from a real zero", () => {
    expect(formatSupplierProductQtyDisplay("loading", 0)).toBe("—");
    expect(formatSupplierProductQtyDisplay("missing", 0)).toBe("—");
    expect(formatSupplierProductQtyDisplay("ready", 0)).toBe("0");
    expect(formatSupplierProductQtyDisplay("ready", 12)).toBe("12");
  });
});

describe("supplierProductLookupStatus", () => {
  it("marks pending fetches as loading", () => {
    expect(supplierProductLookupStatus(true, null)).toBe("loading");
    expect(supplierProductLookupStatus(false, null)).toBe("missing");
    expect(supplierProductLookupStatus(false, productRow("DC7818"))).toBe("ready");
  });
});
