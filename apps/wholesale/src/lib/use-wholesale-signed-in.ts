"use client";

import {
  getGetWholesaleSessionQueryKey,
  useGetWholesaleSession,
} from "@dc-inventory/api-client-wholesale";

export type WholesaleSessionState = {
  signedIn: boolean;
  pending: boolean;
};

export function useWholesaleSession(): WholesaleSessionState {
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
    },
  });

  return {
    signedIn: session.isSuccess && session.data.status === 200,
    pending: session.isPending,
  };
}

export function useWholesaleSignedIn(): boolean {
  return useWholesaleSession().signedIn;
}
