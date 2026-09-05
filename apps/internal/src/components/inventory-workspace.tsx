"use client";

import { RouterTabs } from "@dc-inventory/ui";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function inventoryTabHref(path: string, search: string): string {
  return search === "" ? path : `${path}?${search}`;
}

export function InventoryWorkspace({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <RouterTabs
      className="flex min-h-0 flex-1 flex-col"
      data-testid="inventory-page-router-tabs"
    >
      <RouterTabs.List>
        <RouterTabs.Trigger href={inventoryTabHref("/inventory", search)} exact>
          Stock
        </RouterTabs.Trigger>
        <RouterTabs.Trigger href={inventoryTabHref("/inventory/reopen", search)}>
          Manage Pre-Sell
        </RouterTabs.Trigger>
      </RouterTabs.List>
      <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
        {children}
      </RouterTabs.Panel>
    </RouterTabs>
  );
}
