"use client";

import {
  getGetInternalSessionQueryKey,
  useGetInternalSession,
} from "@dc-inventory/api-client-internal";
import { Dialog } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StaffSignInForm } from "./staff-sign-in-form";

export function StaffSessionGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useGetInternalSession({
    query: { retry: false },
  });

  const signedIn = session.data?.status === 200;

  if (session.isPending && !session.isFetched) {
    return <div className="min-h-screen bg-surface-base" />;
  }

  if (signedIn) {
    return children;
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <Dialog
        open
        onOpenChange={() => {
          return;
        }}
      >
        <Dialog.Content size="sm" data-testid="auth-sign-in-dialog">
          <Dialog.Header>
            <Dialog.Title>Sign in</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <p className="page-description mb-field-group">
              Staff sign-in. After <code>pnpm db:seed:phase1</code>, use
              organization <code>acme</code> with <code>staff@local.test</code>.
            </p>
            <StaffSignInForm
              onSignedIn={() => {
                void queryClient.invalidateQueries({
                  queryKey: getGetInternalSessionQueryKey(),
                });
              }}
            />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
