/**
 * Immutable stock figures at a (sku, locationId) grain.
 * `available` is always derived as onHand - allocated.
 */
export type StockFigures = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
}>;

export function computeAvailable(onHand: number, allocated: number): number {
  return onHand - allocated;
}

export function freezeStockFigures(
  onHand: number,
  onOrder: number,
  allocated: number,
): StockFigures {
  return Object.freeze({
    onHand,
    onOrder,
    allocated,
    available: computeAvailable(onHand, allocated),
  });
}

export const ZERO_STOCK_FIGURES = freezeStockFigures(0, 0, 0);
