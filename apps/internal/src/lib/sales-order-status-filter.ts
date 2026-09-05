import type { FilterOption } from "@dc-inventory/ui-internal";

export const salesOrderStatusFilterOptions = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly FilterOption[];
