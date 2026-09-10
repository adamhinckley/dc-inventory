"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CatalogProductRow } from "./catalog-product-types";
import {
  catalogProductsBySkuQueryKey,
  catalogProductStatusBySku,
  fetchCatalogProductsBySkus,
  type CatalogProductLookupStatus,
} from "./catalog-product-by-sku";

export function useCatalogProductsBySku(skus: readonly string[]): {
  productBySku: Map<string, CatalogProductRow>;
  statusBySku: Map<string, CatalogProductLookupStatus>;
} {
  const uniqueSkus = useMemo(() => [...new Set(skus)], [skus]);
  const enabled = uniqueSkus.length > 0;

  const query = useQuery({
    queryKey: catalogProductsBySkuQueryKey(uniqueSkus),
    enabled,
    queryFn: ({ signal }) => fetchCatalogProductsBySkus(uniqueSkus, { signal }),
  });

  const productBySku = useMemo(() => {
    const map = new Map<string, CatalogProductRow>();
    if (!query.data) {
      return map;
    }
    for (const [sku, product] of query.data) {
      if (product) {
        map.set(sku, product);
      }
    }
    return map;
  }, [query.data]);

  const statusBySku = useMemo(
    () =>
      catalogProductStatusBySku(
        uniqueSkus,
        query.data ?? new Map<string, CatalogProductRow | null>(),
        query.isPending || query.isFetching,
      ),
    [query.data, query.isFetching, query.isPending, uniqueSkus],
  );

  return { productBySku, statusBySku };
}
