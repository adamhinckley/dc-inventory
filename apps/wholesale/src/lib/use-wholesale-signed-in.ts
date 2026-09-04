"use client";

import {
  getGetWholesaleSessionQueryKey,
  useGetWholesaleSession,
} from "@dc-inventory/api-client-wholesale";

export function useWholesaleSignedIn(): boolean {
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
    },
  });

  return session.isSuccess && session.data.status === 200;
}
