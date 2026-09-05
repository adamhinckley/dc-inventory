"use client";

import {
  getListInternalProductsQueryKey,
  listInternalProducts,
} from "@dc-inventory/api-client-internal";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CatalogProductRow } from "./catalog-product-types";
import {
  buildCatalogProductBySku,
  catalogProductFromListResponse,
  catalogProductLookupStatus,
  type CatalogProductLookupStatus,
} from "./catalog-product-by-sku";

const lineSkuSearchParams = (sku: string) => ({
  q: sku,
  page: 1,
  pageSize: 100,
});

export function useCatalogProductsBySku(skus: readonly string[]): {
  productBySku: Map<string, CatalogProductRow>;
  statusBySku: Map<string, CatalogProductLookupStatus>;
} {
  const uniqueSkus = useMemo(() => [...new Set(skus)], [skus]);
  const enabled = uniqueSkus.length > 0;

  const queries = useQueries({
    queries: uniqueSkus.map((sku) => {
      const params = lineSkuSearchParams(sku);
      return {
        queryKey: getListInternalProductsQueryKey(params),
        enabled,
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          listInternalProducts(params, { signal }),
        select: (response: Awaited<ReturnType<typeof listInternalProducts>>) =>
          catalogProductFromListResponse(response, sku),
      };
    }),
  });

  const products = useMemo(
    () => queries.map((query) => query.data),
    [queries],
  );

  const productBySku = useMemo(
    () => buildCatalogProductBySku(uniqueSkus, products),
    [products, uniqueSkus],
  );

  const statusBySku = useMemo(() => {
    const map = new Map<string, CatalogProductLookupStatus>();
    for (const [index, sku] of uniqueSkus.entries()) {
      const query = queries[index];
      map.set(
        sku,
        catalogProductLookupStatus(
          query?.isPending === true || query?.isFetching === true,
          query?.data,
        ),
      );
    }
    return map;
  }, [queries, uniqueSkus]);

  return { productBySku, statusBySku };
}
