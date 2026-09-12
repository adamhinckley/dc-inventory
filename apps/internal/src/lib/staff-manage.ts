import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import { staffRolesFromSession, type StaffSessionRole } from "./customer-types";

/** Mirrors `staff_manage` in staff-action-policy.ts (admin only). */
const STAFF_MANAGE_ROLES = new Set<StaffSessionRole>(["admin"]);

export function canManageStaff(roles: readonly StaffSessionRole[]): boolean {
  return roles.some((role) => STAFF_MANAGE_ROLES.has(role));
}

export function useCanManageStaff(): boolean {
  const sessionQuery = useGetInternalSession();
  const session =
    sessionQuery.data?.status === 200 ? sessionQuery.data.data : undefined;
  const roles = staffRolesFromSession(session);
  return canManageStaff(roles);
}
