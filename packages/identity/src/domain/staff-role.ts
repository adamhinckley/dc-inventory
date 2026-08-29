export const STAFF_ROLES = [
  "admin",
  "purchasing",
  "warehouse",
  "sales_support",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
