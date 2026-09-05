import type { listInternalProducts } from "@dc-inventory/api-client-internal";
import type { CatalogProductRow } from "./catalog-product-types";

export type CatalogProductListResponse = Awaited<ReturnType<typeof listInternalProducts>>;

export type CatalogProductLookupStatus = "loading" | "missing" | "ready";

/** List `q` is substring match — keep only the exact SKU row. */
export function findExactCatalogProductInList(
  items: readonly CatalogProductRow[],
  sku: string,
): CatalogProductRow | undefined {
  return items.find((item) => item.sku === sku);
}

export function catalogProductFromListResponse(
  response: CatalogProductListResponse,
  sku: string,
): CatalogProductRow | null {
  if (response.status !== 200) {
    return null;
  }
  return findExactCatalogProductInList(response.data.items, sku) ?? null;
}

export function buildCatalogProductBySku(
  skus: readonly string[],
  products: ReadonlyArray<CatalogProductRow | null | undefined>,
): Map<string, CatalogProductRow> {
  const map = new Map<string, CatalogProductRow>();
  for (const [index, sku] of skus.entries()) {
    const product = products[index];
    if (product) {
      map.set(sku, product);
    }
  }
  return map;
}

export function catalogProductLookupStatus(
  isPending: boolean,
  product: CatalogProductRow | null | undefined,
): CatalogProductLookupStatus {
  if (isPending) {
    return "loading";
  }
  if (!product) {
    return "missing";
  }
  return "ready";
}
