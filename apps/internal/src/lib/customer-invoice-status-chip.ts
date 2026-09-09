import type { CustomerInvoiceStatus } from "./customer-accounting-types";

const INVOICE_STATUS_CHIP = {
  open: { label: "Open", color: "var(--color-info)" },
  partial: { label: "Partial", color: "var(--color-warning)" },
  past_due: { label: "Past Due", color: "var(--color-error)" },
  paid: { label: "Paid", color: "var(--color-success)" },
} as const satisfies Record<CustomerInvoiceStatus, { label: string; color: string }>;

export function customerInvoiceStatusPresentation(
  status: CustomerInvoiceStatus,
): { label: string; color: string } {
  return INVOICE_STATUS_CHIP[status];
}
