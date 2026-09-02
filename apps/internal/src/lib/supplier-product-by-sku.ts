import type { listInternalSupplierProducts } from "@dc-inventory/api-client-internal";
import type { SupplierProductRow } from "./supplier-product-types";

export type SupplierProductListResponse = Awaited<
  ReturnType<typeof listInternalSupplierProducts>
>;

export type SupplierProductLookupStatus = "loading" | "missing" | "ready";

/** List `q` is substring match — keep only the exact SKU row. */
export function findExactSupplierProductInList(
  items: readonly SupplierProductRow[],
  sku: string,
): SupplierProductRow | undefined {
  return items.find((item) => item.sku === sku);
}

export function supplierProductFromListResponse(
  response: SupplierProductListResponse,
  sku: string,
): SupplierProductRow | null {
  if (response.status !== 200) {
    return null;
  }
  return findExactSupplierProductInList(response.data.items, sku) ?? null;
}

export function buildSupplierProductBySku(
  skus: readonly string[],
  products: ReadonlyArray<SupplierProductRow | null | undefined>,
): Map<string, SupplierProductRow> {
  const map = new Map<string, SupplierProductRow>();
  for (const [index, sku] of skus.entries()) {
    const product = products[index];
    if (product) {
      map.set(sku, product);
    }
  }
  return map;
}

export function supplierProductLookupStatus(
  isPending: boolean,
  product: SupplierProductRow | null | undefined,
): SupplierProductLookupStatus {
  if (isPending) {
    return "loading";
  }
  if (!product) {
    return "missing";
  }
  return "ready";
}

export function formatSupplierProductQtyDisplay(
  status: SupplierProductLookupStatus,
  value: number | null | undefined,
): string {
  if (status !== "ready") {
    return "—";
  }
  return String(value ?? 0);
}

/** Pack size is catalog case qty — missing is blank, not zero. */
export function formatSupplierProductCaseQtyDisplay(
  status: SupplierProductLookupStatus,
  caseQty: number | null | undefined,
): string {
  if (status !== "ready" || caseQty === null || caseQty === undefined) {
    return "—";
  }
  return String(caseQty);
}
