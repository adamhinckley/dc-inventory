import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import type { StaffSessionRole } from "./customer-types";

const DEFAULT_ORGANIZATION_ID = "DEFAULT";

/** Mirrors G8 `organizations_manage` — admin on DEFAULT / platform only. */
export function canManageOrganizations(
  roles: readonly StaffSessionRole[],
  organizationId: string | undefined,
): boolean {
  return (
    organizationId === DEFAULT_ORGANIZATION_ID &&
    roles.some((role) => role === "admin")
  );
}

export function useCanManageOrganizations(): boolean {
  const sessionQuery = useGetInternalSession();
  if (sessionQuery.data?.status !== 200) {
    return false;
  }
  return canManageOrganizations(
    sessionQuery.data.data.roles,
    sessionQuery.data.data.organizationId,
  );
}
