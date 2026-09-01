"use client";

import { AppShell } from "@dc-inventory/ui";
import type { ReactNode } from "react";
import { dashboardNav } from "../lib/dashboard-routes";
import { AccountNavMenu } from "./account-nav-menu";
import { DashboardTableUrlCleanup } from "./dashboard-table-url-cleanup";
import { StaffSessionGate } from "./staff-sign-in-dialog";

function WorkspaceMark() {
  return (
    <span className="flex size-icon-lg items-center justify-center rounded-interactable bg-interactive text-overline text-fg">
      DC
    </span>
  );
}

export function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <StaffSessionGate>
      <DashboardTableUrlCleanup />
      <AppShell
        nav={
          <AppShell.Nav href="/catalog">
            <AppShell.NavGroup id="workspace" label="Workspace" icon={<WorkspaceMark />}>
              {dashboardNav.map((item) => (
                <AppShell.NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                />
              ))}
            </AppShell.NavGroup>
            <AppShell.NavFooter>
              <AccountNavMenu />
            </AppShell.NavFooter>
          </AppShell.Nav>
        }
        topbar={
          <AppShell.Topbar>
            <p className="text-body-sm text-fg-secondary">Staff dashboard</p>
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
            {children}
          </div>
          <p className="px-region-x py-region-y text-caption text-fg-muted">
            © {new Date().getFullYear()} Pull Clear Software
          </p>
        </div>
      </AppShell>
    </StaffSessionGate>
  );
}
