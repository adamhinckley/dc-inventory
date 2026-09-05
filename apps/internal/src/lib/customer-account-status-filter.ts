import type { FilterOption } from "@dc-inventory/ui-internal";
import { CUSTOMER_ACCOUNT_STATUS_OPTIONS } from "./customer-account-status";

export const customerAccountStatusFilterOptions: readonly FilterOption[] =
  CUSTOMER_ACCOUNT_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
