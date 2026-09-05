import type { CustomerAccountStatus } from "./customer-types";

export function customerAccountStatusLabel(status: CustomerAccountStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "on_hold":
      return "On Hold";
    case "inactive":
      return "Inactive";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export const CUSTOMER_ACCOUNT_STATUS_OPTIONS: ReadonlyArray<{
  value: CustomerAccountStatus;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "inactive", label: "Inactive" },
];
