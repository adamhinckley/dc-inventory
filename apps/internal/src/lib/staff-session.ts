import type { QueryClient } from "@tanstack/react-query";

type SessionQuerySnapshot = {
  isPending: boolean;
  isFetched: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  data?: { status: number };
};

export function isStaffSessionSignedIn(session: SessionQuerySnapshot): boolean {
  return session.isSuccess && session.data?.status === 200;
}

export function shouldShowStaffSessionLoading(session: SessionQuerySnapshot): boolean {
  // Idle + pending is the pre-fetch / SSR / `enabled: false` snapshot. Treating
  // that as loading paints a blank surface forever when the query never starts
  // (Next's patched `fetch` during SSR is one way that happens).
  return session.isFetching && !session.isFetched;
}

export function isLogoutAlreadySignedOut(error: unknown): boolean {
  return error instanceof Error && error.message.includes("401");
}

export function shouldCompleteStaffSignOut(
  result: "success" | "error",
  error?: unknown,
): boolean {
  if (result === "success") {
    return true;
  }
  return isLogoutAlreadySignedOut(error);
}

export function completeStaffSignOut(
  queryClient: QueryClient,
  navigate: (path: string) => void,
): void {
  queryClient.clear();
  navigate("/login");
}
