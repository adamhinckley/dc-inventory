import type { OrderId } from "@dc-inventory/shared-kernel";

type OrderCoverMovement = Readonly<{
  movementType: string;
  quantity: number;
  refType: string;
  refId: string;
}>;

/** Net Allocated minus Deallocated for one sales order ref. */
export function netOrderCoverQuantity(
  movements: readonly OrderCoverMovement[],
  orderId: OrderId,
): number {
  let net = 0;
  for (const movement of movements) {
    if (movement.refType !== "sales_order" || movement.refId !== orderId) {
      continue;
    }
    if (movement.movementType === "Allocated") {
      net += movement.quantity;
    } else if (movement.movementType === "Deallocated") {
      net -= movement.quantity;
    }
  }
  return net;
}

/** Warehouse cover to release when decommitting one confirmed line. */
export function computeLineDeallocateQuantity(lineQty: number, orderCoverQty: number): number {
  return Math.min(lineQty, orderCoverQty);
}
