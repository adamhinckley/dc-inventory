import type { OrderId } from "@dc-inventory/shared-kernel";

export type OrderCoverMovement = Readonly<{
  movementType: string;
  quantity: number;
  refType: string;
  refId: string;
  createdAt: Date;
}>;

/** Net Committed minus Decommitted for one sales order ref. */
export function netOrderCommittedQuantity(
  movements: readonly OrderCoverMovement[],
  orderId: OrderId,
): number {
  let net = 0;
  for (const movement of movements) {
    if (movement.refType !== "sales_order" || movement.refId !== orderId) {
      continue;
    }
    if (movement.movementType === "Committed") {
      net += movement.quantity;
    } else if (movement.movementType === "Decommitted") {
      net -= movement.quantity;
    }
  }
  return net;
}

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

export type FifoUncoveredOrder = Readonly<{
  orderId: string;
  uncoveredQty: number;
}>;

/**
 * Committed sales orders with toOrder demand, oldest commit first.
 * Uncovered per order = net committed minus net cover for that order ref.
 */
export function listFifoUncoveredCommittedOrders(
  movements: readonly OrderCoverMovement[],
): readonly FifoUncoveredOrder[] {
  const firstCommittedAt = new Map<string, Date>();
  const netCommittedByOrder = new Map<string, number>();
  const netCoveredByOrder = new Map<string, number>();

  for (const movement of movements) {
    if (movement.refType !== "sales_order") {
      continue;
    }
    const orderId = movement.refId;
    if (movement.movementType === "Committed") {
      netCommittedByOrder.set(orderId, (netCommittedByOrder.get(orderId) ?? 0) + movement.quantity);
      const existing = firstCommittedAt.get(orderId);
      if (existing === undefined || movement.createdAt < existing) {
        firstCommittedAt.set(orderId, movement.createdAt);
      }
    } else if (movement.movementType === "Decommitted") {
      netCommittedByOrder.set(orderId, (netCommittedByOrder.get(orderId) ?? 0) - movement.quantity);
    } else if (movement.movementType === "Allocated") {
      netCoveredByOrder.set(orderId, (netCoveredByOrder.get(orderId) ?? 0) + movement.quantity);
    } else if (movement.movementType === "Deallocated") {
      netCoveredByOrder.set(orderId, (netCoveredByOrder.get(orderId) ?? 0) - movement.quantity);
    }
  }

  const fifoOrderIds = [...netCommittedByOrder.keys()]
    .filter((orderId) => (netCommittedByOrder.get(orderId) ?? 0) > 0)
    .sort((left, right) => {
      const leftAt = firstCommittedAt.get(left)?.getTime() ?? 0;
      const rightAt = firstCommittedAt.get(right)?.getTime() ?? 0;
      if (leftAt !== rightAt) {
        return leftAt - rightAt;
      }
      return left.localeCompare(right);
    });

  return fifoOrderIds
    .map((orderId) => {
      const committed = netCommittedByOrder.get(orderId) ?? 0;
      const covered = netCoveredByOrder.get(orderId) ?? 0;
      return Object.freeze({
        orderId,
        uncoveredQty: Math.max(0, committed - covered),
      });
    })
    .filter((row) => row.uncoveredQty > 0);
}
