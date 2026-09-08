import { purchaseOrderStatusFilterOptions } from "./purchase-order-status-filter";

const PURCHASE_ORDER_STATUS_CHIP = {
  draft: { label: "Draft", color: "var(--color-fg-secondary)" },
  confirmed: { label: "Issued", color: "var(--color-info)" },
  received: { label: "Received", color: "var(--color-success)" },
  cancelled: { label: "Cancelled", color: "var(--color-error)" },
} as const satisfies Record<
  (typeof purchaseOrderStatusFilterOptions)[number]["value"],
  { label: string; color: string }
>;

export function purchaseOrderStatusPresentation(
  status: unknown,
): { label: string; color: string } | null {
  if (typeof status !== "string" || !(status in PURCHASE_ORDER_STATUS_CHIP)) {
    return null;
  }
  return PURCHASE_ORDER_STATUS_CHIP[
    status as keyof typeof PURCHASE_ORDER_STATUS_CHIP
  ];
}

export function purchaseOrderStatusLabel(status: unknown): string {
  const presentation = purchaseOrderStatusPresentation(status);
  if (presentation === null) {
    return typeof status === "string" ? status : "—";
  }
  return presentation.label;
}
