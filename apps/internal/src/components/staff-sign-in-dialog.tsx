"use client";

import {
  getGetInternalSessionQueryKey,
  useGetInternalSession,
} from "@dc-inventory/api-client-internal";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { dashboardHomePath } from "../lib/dashboard-home-path";
import {
  isStaffSessionSignedIn,
  shouldShowStaffSessionLoading,
} from "../lib/staff-session";
import { StaffSignInForm } from "./staff-sign-in-form";

export function StaffSessionGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sessionQueryEnabled, setSessionQueryEnabled] = useState(false);
  useEffect(() => {
    setSessionQueryEnabled(true);
  }, []);
  const session = useGetInternalSession({
    query: {
      queryKey: getGetInternalSessionQueryKey(),
      retry: false,
      enabled: sessionQueryEnabled,
    },
  });

  const signedIn = isStaffSessionSignedIn(session);

  if (signedIn) {
    return children;
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface-base px-region-x"
      aria-busy={shouldShowStaffSessionLoading(session)}
    >
      <section
        className="section-flat w-full max-w-md p-panel"
        data-testid="auth-sign-in-dialog"
      >
        <h1 className="page-title">Sign in</h1>
        <p className="page-description mt-2">
          Staff sign-in uses organization <code>acme</code> with <code>staff@local.test</code>.
          Platform sign-in uses <code>adam@local.test</code> with no organization slug.
        </p>
        <div className="mt-8">
          <StaffSignInForm
            onSignedIn={(session) => {
              void queryClient.invalidateQueries({
                queryKey: getGetInternalSessionQueryKey(),
              });
              if (session.audience === "platform") {
                router.replace(dashboardHomePath("platform"));
              }
            }}
          />
        </div>
      </section>
    </div>
  );
}
