export const VISIBLE_ORDER_STATUSES = ["confirmed", "shipped", "cancelled"] as const;

export type VisibleOrderStatus = (typeof VISIBLE_ORDER_STATUSES)[number];

export function isVisibleOrderStatus(status: string): status is VisibleOrderStatus {
  return (VISIBLE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function orderLineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

export function orderSubtotalCents(
  lines: readonly { qty: number; unitPriceCents: number }[],
): number {
  return lines.reduce(
    (sum, line) => sum + orderLineSubtotalCents(line.qty, line.unitPriceCents),
    0,
  );
}

export function orderHistoryPath(documentNumber: string): string {
  return `/orders/${encodeURIComponent(documentNumber)}`;
}

export function formatOrderStatus(status: string): string {
  if (status.length === 0) {
    return status;
  }
  return `${status[0]?.toUpperCase() ?? ""}${status.slice(1)}`;
}

export function formatOrderDate(isoDate: string | undefined): string {
  if (isoDate === undefined) {
    return "—";
  }
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
