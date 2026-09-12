"use client";

import { AppShell } from "@dc-inventory/ui";
import { Building2 } from "lucide-react";
import { useCanManageOrganizations } from "../lib/staff-organizations-manage";

function PlatformMark() {
  return (
    <span className="flex size-icon-lg items-center justify-center rounded-interactable bg-interactive text-overline text-fg">
      <Building2 className="size-icon-md" aria-hidden />
    </span>
  );
}

export function PlatformNavItems() {
  const canManageOrganizations = useCanManageOrganizations();

  if (!canManageOrganizations) {
    return null;
  }

  return (
    <AppShell.NavGroup id="platform" label="Platform" icon={<PlatformMark />}>
      <AppShell.NavItem href="/organizations/new" label="Add Company" />
    </AppShell.NavGroup>
  );
}
