"use client";

import { RouterTabs } from "@dc-inventory/ui";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { accountingTabHref } from "../lib/accounting-url-params";

export { accountingTabHref };

export function AccountingWorkspace({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <RouterTabs
      className="flex min-h-0 flex-1 flex-col"
      data-testid="accounting-page-router-tabs"
    >
      <RouterTabs.List>
        <RouterTabs.Trigger href={accountingTabHref("/accounting", search)} exact>
          Balances
        </RouterTabs.Trigger>
        <RouterTabs.Trigger
          href={accountingTabHref("/accounting/payments", search)}
        >
          Payments
        </RouterTabs.Trigger>
      </RouterTabs.List>
      <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
        {children}
      </RouterTabs.Panel>
    </RouterTabs>
  );
}
