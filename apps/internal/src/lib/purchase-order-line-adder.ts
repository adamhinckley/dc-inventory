import type { PurchaseOrderLineDraft } from "./purchase-order-types";

/**
 * Ceil need to the next master pack (`cs_qty`). Need 584 with 100/case → 600.
 * No need yet keeps today's picker default of 1.
 */
export function suggestedDraftPoQty(
  need: number,
  caseQty: number | null,
): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}

export function casesForDraftPoQty(
  qty: number,
  caseQty: number | null,
): number | null {
  if (caseQty === null || caseQty <= 0) {
    return null;
  }
  return qty / caseQty;
}

/**
 * A picker click becomes a draft line. Qty covers uncovered demand,
 * rounded up to a master pack when case qty exists.
 */
export function draftLineFromVendorProduct(product: {
  sku: string;
  catalogName: string;
  caseQty?: number | null;
  qty?: { uncovered: number };
}): PurchaseOrderLineDraft {
  return {
    id: crypto.randomUUID(),
    sku: product.sku,
    name: product.catalogName,
    qty: suggestedDraftPoQty(product.qty?.uncovered ?? 0, product.caseQty ?? null),
  };
}
