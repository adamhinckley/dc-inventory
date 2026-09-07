"use client";

import { RouterTabs } from "@dc-inventory/ui";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function purchasing2TabHref(path: string, search: string): string {
  return search === "" ? path : `${path}?${search}`;
}

export function Purchasing2Workspace({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <RouterTabs
      className="flex min-h-0 flex-1 flex-col"
      data-testid="purchasing-2-page-router-tabs"
    >
      <RouterTabs.List>
        <RouterTabs.Trigger href={purchasing2TabHref("/purchasing-2", search)} exact>
          Draft POs
        </RouterTabs.Trigger>
        <RouterTabs.Trigger href={purchasing2TabHref("/purchasing-2/uncovered", search)}>
          Uncovered
        </RouterTabs.Trigger>
      </RouterTabs.List>
      <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
        {children}
      </RouterTabs.Panel>
    </RouterTabs>
  );
}
