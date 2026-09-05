import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import type { StaffSessionRole } from "./customer-types";

/** Mirrors `master_data_manage` in staff-action-policy.ts (admin | purchasing). */
const MASTER_DATA_MANAGE_ROLES = new Set<StaffSessionRole>(["admin", "purchasing"]);

export function canManageMasterData(roles: readonly StaffSessionRole[]): boolean {
  return roles.some((role) => MASTER_DATA_MANAGE_ROLES.has(role));
}

export function useCanManageMasterData(): boolean {
  const sessionQuery = useGetInternalSession();
  const roles =
    sessionQuery.data?.status === 200 ? sessionQuery.data.data.roles : [];
  return canManageMasterData(roles);
}
