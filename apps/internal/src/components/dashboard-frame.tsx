"use client";

import { useGetInternalSession } from "@dc-inventory/api-client-internal";
import { AppShell } from "@dc-inventory/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  dashboardHomePath,
  shouldRedirectDashboardHome,
} from "../lib/dashboard-home-path";
import { dashboardNav } from "../lib/dashboard-routes";
import { useIsPlatformSession } from "../lib/staff-organizations-manage";
import { AccountNavMenu } from "./account-nav-menu";
import {
  DashboardBreadcrumb,
  DashboardBreadcrumbProvider,
} from "./dashboard-breadcrumb";
import { DashboardTableUrlCleanup } from "./dashboard-table-url-cleanup";
import { PlatformNavItems } from "./platform-nav-items";
import { StaffSessionGate } from "./staff-sign-in-dialog";

function WorkspaceMark() {
  return (
    <span className="flex size-icon-lg items-center justify-center rounded-interactable bg-interactive text-overline text-fg">
      DC
    </span>
  );
}

function WorkspaceNavItems() {
  const isPlatformSession = useIsPlatformSession();
  if (isPlatformSession) {
    return null;
  }
  return (
    <AppShell.NavGroup id="workspace" label="Workspace" icon={<WorkspaceMark />}>
      {dashboardNav.map((item) => (
        <AppShell.NavItem key={item.href} href={item.href} label={item.label} />
      ))}
    </AppShell.NavGroup>
  );
}

function DashboardHomeRedirect({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = useGetInternalSession();
  const session =
    sessionQuery.data?.status === 200 ? sessionQuery.data.data : undefined;
  const shouldLeave =
    session !== undefined && shouldRedirectDashboardHome(session.audience, pathname);

  useEffect(() => {
    if (session === undefined || !shouldLeave) {
      return;
    }
    router.replace(dashboardHomePath(session.audience));
  }, [session, shouldLeave, router]);

  if (shouldLeave) {
    return <p className="text-fg-muted">Loading…</p>;
  }
  return children;
}

export function DashboardFrame({ children }: { children: ReactNode }) {
  const isPlatformSession = useIsPlatformSession();
  const brandHref = dashboardHomePath(isPlatformSession ? "platform" : "staff");

  return (
    <StaffSessionGate>
      <DashboardBreadcrumbProvider>
        <DashboardTableUrlCleanup />
        <AppShell
          nav={
            <AppShell.Nav href={brandHref}>
              <WorkspaceNavItems />
              <PlatformNavItems />
              <AppShell.NavFooter>
                <AccountNavMenu />
              </AppShell.NavFooter>
            </AppShell.Nav>
          }
          topbar={
            <AppShell.Topbar>
              <DashboardBreadcrumb />
              <AppShell.TopbarActions>
                <div
                  id="dashboard-topbar-actions"
                  className="flex items-center gap-tight"
                />
              </AppShell.TopbarActions>
            </AppShell.Topbar>
          }
        >
          <div className="flex min-h-full flex-col has-data-sticky-table:h-full has-data-sticky-table:min-h-0">
            <div className="flex-1 p-canvas has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-col">
              <DashboardHomeRedirect>{children}</DashboardHomeRedirect>
            </div>
            <p className="px-region-x py-region-y text-caption text-fg-muted">
              © {new Date().getFullYear()} Pull Clear Software
            </p>
          </div>
        </AppShell>
      </DashboardBreadcrumbProvider>
    </StaffSessionGate>
  );
}
