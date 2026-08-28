export type LineAdderSelection = {
  selectedSkus: string[];
  error: string | null;
};

/**
 * Staged SKU picks belong to one vendor. Switching vendors returns an
 * empty selection so submit cannot keep SKUs from the previous catalog.
 * Same vendor returns undefined: keep the current picks and error.
 */
export function lineAdderSelectionForSupplier(
  previousSupplierId: string,
  nextSupplierId: string,
): LineAdderSelection | undefined {
  if (previousSupplierId === nextSupplierId) {
    return undefined;
  }
  return { selectedSkus: [], error: null };
}
