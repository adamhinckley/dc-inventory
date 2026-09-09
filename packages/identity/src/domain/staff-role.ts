export const STAFF_ROLES = [
  "admin",
  "purchasing",
  "warehouse",
  "sales_support",
  "accounting",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
