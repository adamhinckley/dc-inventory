"use client";

import { RouterTabs } from "@dc-inventory/ui";
import type { ReactNode } from "react";
import {
  ACCOUNTING_BALANCES_PATH,
  ACCOUNTING_PAYMENTS_PATH,
} from "../lib/accounting-url-params";
import { useAccountingUrl } from "../lib/use-accounting-url";

export { accountingTabHref } from "../lib/accounting-url-params";

export function AccountingWorkspace({ children }: { children: ReactNode }) {
  const { tabHref } = useAccountingUrl();

  return (
    <RouterTabs
      className="flex min-h-0 flex-1 flex-col"
      data-testid="accounting-page-router-tabs"
    >
      <RouterTabs.List>
        <RouterTabs.Trigger href={tabHref(ACCOUNTING_BALANCES_PATH)} exact>
          Balances
        </RouterTabs.Trigger>
        <RouterTabs.Trigger href={tabHref(ACCOUNTING_PAYMENTS_PATH)}>
          Payments
        </RouterTabs.Trigger>
      </RouterTabs.List>
      <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
        {children}
      </RouterTabs.Panel>
    </RouterTabs>
  );
}
