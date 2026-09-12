import type { StaffSessionRole } from "./customer-types";

const STAFF_ROLE_LABELS: Record<StaffSessionRole, string> = {
  admin: "Admin",
  purchasing: "Purchasing",
  warehouse: "Warehouse",
  sales_support: "Sales Support",
  accounting: "Accounting",
};

export function staffRoleLabel(role: StaffSessionRole): string {
  return STAFF_ROLE_LABELS[role];
}

export const STAFF_ROLE_OPTIONS: { value: StaffSessionRole; label: string }[] = (
  Object.entries(STAFF_ROLE_LABELS) as [StaffSessionRole, string][]
).map(([value, label]) => ({ value, label }));
