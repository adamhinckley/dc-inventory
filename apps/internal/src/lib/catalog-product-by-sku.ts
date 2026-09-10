import {
  getListInternalProductsQueryKey,
  listInternalProducts,
} from "@dc-inventory/api-client-internal";
import type { CatalogProductRow } from "./catalog-product-types";

export type CatalogProductListResponse = Awaited<ReturnType<typeof listInternalProducts>>;

export type CatalogProductLookupStatus = "loading" | "missing" | "ready";

const catalogProductSkuSearchParams = (sku: string) => ({
  q: sku,
  page: 1,
  pageSize: 100,
});

export function catalogProductsBySkuQueryKey(skus: readonly string[]): readonly unknown[] {
  return [...getListInternalProductsQueryKey(), "catalog-by-sku", [...new Set(skus)].sort()];
}

/** Resolve many line SKUs in one React Query (parallel list calls, shared loading). */
export async function fetchCatalogProductsBySkus(
  skus: readonly string[],
  options?: { signal?: AbortSignal },
): Promise<Map<string, CatalogProductRow | null>> {
  const uniqueSkus = [...new Set(skus)];
  const map = new Map<string, CatalogProductRow | null>();
  if (uniqueSkus.length === 0) {
    return map;
  }

  const responses = await Promise.all(
    uniqueSkus.map((sku) =>
      listInternalProducts(catalogProductSkuSearchParams(sku), {
        signal: options?.signal,
      }),
    ),
  );

  for (const [index, sku] of uniqueSkus.entries()) {
    const response = responses[index];
    map.set(
      sku,
      response ? catalogProductFromListResponse(response, sku) : null,
    );
  }
  return map;
}

export function catalogProductStatusBySku(
  skus: readonly string[],
  productsBySku: ReadonlyMap<string, CatalogProductRow | null | undefined>,
  isPending: boolean,
): Map<string, CatalogProductLookupStatus> {
  const map = new Map<string, CatalogProductLookupStatus>();
  for (const sku of skus) {
    map.set(
      sku,
      catalogProductLookupStatus(isPending, productsBySku.get(sku)),
    );
  }
  return map;
}

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
