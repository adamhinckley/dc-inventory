export { netOrderCoverQuantity } from "@dc-inventory/inventory";

/** Warehouse cover to release when decommitting one confirmed line. */
export function computeLineDeallocateQuantity(lineQty: number, orderCoverQty: number): number {
  return Math.min(lineQty, orderCoverQty);
}
