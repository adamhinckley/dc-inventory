/**
 * Allocated createdAt for a planned sales order.
 *
 * Idle Park invoice dates can precede the sales-order instant so AR buckets
 * age correctly. Reconciliation sorts movements by createdAt, then type, so
 * Allocated must not land after Shipped on that clock.
 */
export function allocateInstant(
  orderPlannedInstant: Date,
  shipAt: Date,
  shipped: boolean,
): Date {
  if (!shipped) {
    return orderPlannedInstant;
  }
  return new Date(Math.min(orderPlannedInstant.getTime(), shipAt.getTime()));
}
