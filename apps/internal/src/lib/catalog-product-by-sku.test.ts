import { describe, expect, it } from "vitest";
import type { CatalogProductRow } from "./catalog-product-types";
import {
  buildCatalogProductBySku,
  catalogProductFromListResponse,
  findExactCatalogProductInList,
} from "./catalog-product-by-sku";

function productRow(sku: string): CatalogProductRow {
  return {
    id: `prod-${sku}`,
    sku,
    name: sku,
    memberPrice: 100,
    listPrice: 100,
    lastPoCostCents: null,
    currency: "USD",
    inactive: false,
    discontinued: false,
    webWholesale: true,
    onHand: 0,
    onOrder: 0,
    allocated: 0,
    available: 0,
    committed: 0,
    sellState: "open",
    availableToSell: 0,
    caseQty: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("findExactCatalogProductInList", () => {
  it("matches SKU exactly when list q is a substring search", () => {
    const items = [productRow("DC7818"), productRow("DC78180")];
    expect(findExactCatalogProductInList(items, "DC7818")?.sku).toBe("DC7818");
    expect(findExactCatalogProductInList(items, "DC78180")?.sku).toBe("DC78180");
    expect(findExactCatalogProductInList(items, "DC7819")).toBeUndefined();
  });
});

describe("catalogProductFromListResponse", () => {
  it("hydrates a line SKU that is not on page 1 of the catalog list", () => {
    const offPageSku = "OFF-PAGE-SKU";
    const response = {
      status: 200 as const,
      data: {
        items: [productRow(offPageSku)],
        page: 1,
        pageSize: 100,
        total: 1,
      },
      headers: new Headers(),
    };
    const product = catalogProductFromListResponse(response, offPageSku);
    expect(product?.id).toBe(`prod-${offPageSku}`);

    const merged = buildCatalogProductBySku([offPageSku], [product]);
    expect(merged.get(offPageSku)?.id).toBe(`prod-${offPageSku}`);
  });
});
