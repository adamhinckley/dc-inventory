import { salesOrderStatusFilterOptions } from "./sales-order-status-filter";

const SALES_ORDER_STATUS_CHIP = {
  draft: { label: "Draft", color: "var(--color-fg-secondary)" },
  confirmed: { label: "Confirmed", color: "var(--color-info)" },
  shipped: { label: "Shipped", color: "var(--color-success)" },
  cancelled: { label: "Cancelled", color: "var(--color-error)" },
} as const satisfies Record<
  (typeof salesOrderStatusFilterOptions)[number]["value"],
  { label: string; color: string }
>;

export function salesOrderStatusPresentation(
  status: unknown,
): { label: string; color: string } | null {
  if (typeof status !== "string" || !(status in SALES_ORDER_STATUS_CHIP)) {
    return null;
  }
  return SALES_ORDER_STATUS_CHIP[status as keyof typeof SALES_ORDER_STATUS_CHIP];
}
