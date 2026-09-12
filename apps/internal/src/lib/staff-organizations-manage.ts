import { useGetInternalSession } from "@dc-inventory/api-client-internal";

export function useIsPlatformSession(): boolean {
  const sessionQuery = useGetInternalSession();
  if (sessionQuery.data?.status !== 200) {
    return false;
  }
  return sessionQuery.data.data.audience === "platform";
}

/** @deprecated Use useIsPlatformSession — organizations_manage is Platform-user-only. */
export function useCanManageOrganizations(): boolean {
  return useIsPlatformSession();
}
