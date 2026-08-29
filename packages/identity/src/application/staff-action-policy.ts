import type { StaffRole } from "../domain/staff-role.js";

export const STAFF_ACTIONS = [
  "master_data_manage",
  "purchase_orders_manage",
  "stock_manage",
  "sales_orders_manage",
  "payments_apply",
] as const;

export type StaffAction = (typeof STAFF_ACTIONS)[number];

const ALLOWED_ROLES: Readonly<Record<StaffAction, ReadonlySet<StaffRole>>> = {
  master_data_manage: new Set(["admin", "purchasing"]),
  purchase_orders_manage: new Set(["admin", "purchasing"]),
  stock_manage: new Set(["admin", "warehouse"]),
  sales_orders_manage: new Set(["admin", "sales_support"]),
  payments_apply: new Set(["admin"]),
};

export function canStaffPerform(
  roles: readonly StaffRole[],
  action: StaffAction,
): boolean {
  const allowedRoles = ALLOWED_ROLES[action];
  return roles.some((role) => allowedRoles.has(role));
}
