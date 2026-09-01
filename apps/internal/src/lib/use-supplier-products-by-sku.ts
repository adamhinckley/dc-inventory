"use client";

import {
  getListInternalSupplierProductsQueryKey,
  listInternalSupplierProducts,
} from "@dc-inventory/api-client-internal";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SupplierProductRow } from "./supplier-product-types";
import {
  buildSupplierProductBySku,
  supplierProductFromListResponse,
  supplierProductLookupStatus,
  type SupplierProductLookupStatus,
} from "./supplier-product-by-sku";

const lineSkuSearchParams = (sku: string) => ({
  q: sku,
  page: 1,
  pageSize: 100,
});

export function useSupplierProductsBySku(
  supplierId: string | null,
  skus: readonly string[],
): {
  productBySku: Map<string, SupplierProductRow>;
  statusBySku: Map<string, SupplierProductLookupStatus>;
} {
  const uniqueSkus = useMemo(() => [...new Set(skus)], [skus]);
  const enabled = supplierId !== null && uniqueSkus.length > 0;

  const queries = useQueries({
    queries: uniqueSkus.map((sku) => {
      const params = lineSkuSearchParams(sku);
      return {
        queryKey: getListInternalSupplierProductsQueryKey(supplierId ?? "", params),
        enabled,
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          listInternalSupplierProducts(supplierId ?? "", params, { signal }),
        select: (response: Awaited<ReturnType<typeof listInternalSupplierProducts>>) =>
          supplierProductFromListResponse(response, sku),
      };
    }),
  });

  const products = useMemo(
    () => queries.map((query) => query.data),
    [queries],
  );

  const productBySku = useMemo(
    () => buildSupplierProductBySku(uniqueSkus, products),
    [products, uniqueSkus],
  );

  const statusBySku = useMemo(() => {
    const map = new Map<string, SupplierProductLookupStatus>();
    for (const [index, sku] of uniqueSkus.entries()) {
      const query = queries[index];
      map.set(
        sku,
        supplierProductLookupStatus(
          query?.isPending === true || query?.isFetching === true,
          query?.data,
        ),
      );
    }
    return map;
  }, [queries, uniqueSkus]);

  return { productBySku, statusBySku };
}
