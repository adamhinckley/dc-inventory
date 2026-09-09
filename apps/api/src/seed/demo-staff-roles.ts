import type { StaffRole } from "@dc-inventory/identity";

/** Demo staff@local.test always includes admin and accounting (ADA-358). */
export function withDemoStaffRoles(existing: readonly StaffRole[] | undefined): StaffRole[] {
  return [...new Set<StaffRole>([...(existing ?? ["admin"]), "accounting"])];
}
