import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import type { InternalSession } from "./customer-types";

export function isPlatformSession(session: InternalSession | undefined): boolean {
  return session?.audience === "platform";
}

export function useIsPlatformSession(): boolean {
  const sessionQuery = useGetInternalSession();
  const session =
    sessionQuery.data?.status === 200 ? sessionQuery.data.data : undefined;
  return isPlatformSession(session);
}

/** @deprecated Use useIsPlatformSession — organizations_manage is Platform-user-only. */
export function useCanManageOrganizations(): boolean {
  return useIsPlatformSession();
}
