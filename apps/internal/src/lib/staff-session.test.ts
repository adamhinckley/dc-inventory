import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  completeStaffSignOut,
  isLogoutAlreadySignedOut,
  isStaffSessionSignedIn,
  shouldCompleteStaffSignOut,
  shouldShowStaffSessionLoading,
} from "./staff-session";

describe("staff session gate", () => {
  it("shows children only on a successful 200 session", () => {
    expect(
      isStaffSessionSignedIn({
        isPending: false,
        isFetched: true,
        isSuccess: true,
        data: { status: 200 },
      }),
    ).toBe(true);
    expect(
      isStaffSessionSignedIn({
        isPending: false,
        isFetched: true,
        isSuccess: false,
        data: { status: 200 },
      }),
    ).toBe(false);
    expect(
      isStaffSessionSignedIn({
        isPending: false,
        isFetched: true,
        isSuccess: true,
        data: { status: 401 },
      }),
    ).toBe(false);
  });

  it("fails closed when a live session later returns unauthorized", () => {
    expect(
      isStaffSessionSignedIn({
        isPending: false,
        isFetched: true,
        isSuccess: false,
        data: { status: 200 },
      }),
    ).toBe(false);
  });

  it("shows the loading shell only before the first session fetch settles", () => {
    expect(
      shouldShowStaffSessionLoading({
        isPending: true,
        isFetched: false,
        isSuccess: false,
      }),
    ).toBe(true);
    expect(
      shouldShowStaffSessionLoading({
        isPending: true,
        isFetched: true,
        isSuccess: true,
        data: { status: 200 },
      }),
    ).toBe(false);
  });
});

describe("staff sign-out", () => {
  it("treats HTTP 401 as already signed out", () => {
    expect(isLogoutAlreadySignedOut(new Error("HTTP 401 Unauthorized"))).toBe(true);
    expect(isLogoutAlreadySignedOut(new Error("HTTP 500 Internal Server Error"))).toBe(
      false,
    );
    expect(shouldCompleteStaffSignOut("success")).toBe(true);
    expect(
      shouldCompleteStaffSignOut("error", new Error("HTTP 401 Unauthorized")),
    ).toBe(true);
    expect(
      shouldCompleteStaffSignOut("error", new Error("Failed to fetch")),
    ).toBe(false);
  });

  it("clears the entire query cache after a successful sign-out", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/internal/auth/session"], { status: 200 });
    queryClient.setQueryData(["/internal/products"], { items: ["sku-a"] });

    const navigated: string[] = [];
    completeStaffSignOut(queryClient, (path) => navigated.push(path));

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(navigated).toEqual(["/login"]);
  });
});
