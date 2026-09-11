import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";

export const CATALOG_PRODUCT_EDIT_LOAD_ERROR = "Could not load this product.";
export const CATALOG_PRODUCT_EDIT_LOAD_PENDING = "Loading product…";

/**
 * Copy for the catalog edit dialog while the product body is missing.
 * Internal Orval `customFetch` returns `{ data, status, headers }` and does
 * not throw on HTTP 500, so React Query `isError` stays false on a failed
 * envelope. Treat non-2xx the same way `isListQueryFailed` does for tables.
 */
export function catalogProductEditLoadCopy(query: {
  data: unknown;
  isError: boolean;
}): typeof CATALOG_PRODUCT_EDIT_LOAD_ERROR | typeof CATALOG_PRODUCT_EDIT_LOAD_PENDING {
  const envelopeFailed =
    query.data !== undefined && !isSuccessfulOrvalResponse(query.data);
  if (query.isError || envelopeFailed) {
    return CATALOG_PRODUCT_EDIT_LOAD_ERROR;
  }
  return CATALOG_PRODUCT_EDIT_LOAD_PENDING;
}
