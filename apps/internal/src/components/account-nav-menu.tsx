"use client";

import {
  getGetInternalSessionQueryKey,
  useGetInternalSession,
  useLogoutInternal,
} from "@dc-inventory/api-client-internal";
import { Menu, useAppShellContext } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountMenuIdentity } from "../lib/account-menu-identity";
import { COLOR_SCHEMES, type ColorScheme } from "../lib/color-scheme";
import {
  completeStaffSignOut,
  shouldCompleteStaffSignOut,
} from "../lib/staff-session";
import { useColorScheme } from "./color-scheme-provider";

const SCHEME_LABELS: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function AccountNavMenu() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isExpanded } = useAppShellContext();
  const { scheme, setScheme } = useColorScheme();
  const session = useGetInternalSession({
    query: {
      queryKey: getGetInternalSessionQueryKey(),
      retry: false,
    },
  });
  const logout = useLogoutInternal();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const identity = accountMenuIdentity(
    session.isSuccess && session.data.status === 200 ? session.data.data : undefined,
  );

  function signOut() {
    setSignOutError(null);
    logout.mutate(undefined, {
      onSuccess: () => {
        completeStaffSignOut(queryClient, (path) => router.push(path));
      },
      onError: (error) => {
        if (shouldCompleteStaffSignOut("error", error)) {
          completeStaffSignOut(queryClient, (path) => router.push(path));
          return;
        }
        setSignOutError("Could not sign out. Check your connection and try again.");
      },
    });
  }

  return (
    <Menu>
      <Menu.Trigger
        aria-label="Account"
        data-testid="shell-account-menu-trigger"
        className="interactable subtle mb-action flex w-full items-center gap-icon px-input-x py-item-y text-body focus-visible:-outline-offset-2"
      >
        <span className="flex size-icon-lg shrink-0 items-center justify-center">
          <User className="size-full" aria-hidden />
        </span>
        {isExpanded ? <span className="truncate text-left">Account</span> : null}
      </Menu.Trigger>
      <Menu.Content
        side="right"
        align="end"
        data-testid="shell-account-menu"
      >
        <div className="item-padding">
          <p className="text-body font-semibold text-fg">{identity.displayName}</p>
          {identity.email.length > 0 && identity.email !== identity.displayName ? (
            <p className="text-caption text-fg-secondary">{identity.email}</p>
          ) : null}
        </div>
        <Menu.Separator />
        <Menu.Group>
          <Menu.GroupLabel>Appearance</Menu.GroupLabel>
          {COLOR_SCHEMES.map((option) => (
            <Menu.Item
              key={option}
              closeOnClick={false}
              onClick={() => setScheme(option)}
            >
              <Check
                className="size-icon"
                aria-hidden
                style={{ visibility: scheme === option ? "visible" : "hidden" }}
              />
              {SCHEME_LABELS[option]}
            </Menu.Item>
          ))}
        </Menu.Group>
        <Menu.Separator />
        {signOutError !== null ? (
          <p className="item-padding form-error" role="alert">
            {signOutError}
          </p>
        ) : null}
        <Menu.Item closeOnClick={false} onClick={signOut} disabled={logout.isPending}>
          {logout.isPending ? "Signing out…" : "Sign out"}
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
