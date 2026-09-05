export const VISIBLE_ORDER_STATUSES = ["confirmed", "shipped", "cancelled"] as const;

export type VisibleOrderStatus = (typeof VISIBLE_ORDER_STATUSES)[number];

export function isVisibleOrderStatus(status: string): status is VisibleOrderStatus {
  return (VISIBLE_ORDER_STATUSES as readonly string[]).includes(status);
}
