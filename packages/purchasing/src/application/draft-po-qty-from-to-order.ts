/**
 * Matches `suggestedDraftPoQty` in apps/internal purchase-order-line-math.
 * Ceil toOrder need to the next master pack when case qty exists.
 */
export function draftPoQtyFromToOrder(need: number, caseQty: number | null): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}
