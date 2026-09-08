import type { FilterOption } from "@dc-inventory/ui-internal";

export const purchaseOrderStatusFilterOptions = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Issued" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly FilterOption[];
