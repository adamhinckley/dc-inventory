"use client";

import { buttonVariants, ExplorerView, RouterTabs } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  PurchaseOrdersTable,
  type PurchaseOrdersList,
} from "./purchase-orders-table";

export function PurchasingOrdersExplorer({
  list,
  initialParams,
  children,
}: {
  list: PurchaseOrdersList;
  initialParams?: ListQueryParams;
  children?: ReactNode;
}) {
  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        {children}
        <header className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-label text-fg-secondary">Purchasing</p>
            <h1 className="page-title mt-1">Purchase orders</h1>
            <p className="page-description mt-2">
              Drafts stay editable. Finalize moves a PO to Completed, where you
              can look it up, view lines, and download XLS.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-action">
            <Link
              href="/purchasing/suppliers"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Suppliers
            </Link>
            <Link
              href="/purchasing/new"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              <Plus className="size-icon-lg" />
              New draft PO
            </Link>
          </div>
        </header>
        <RouterTabs
          data-testid="purchasing-orders-router-tabs"
          className="mt-region rounded-none border-0 bg-transparent"
        >
          <RouterTabs.List>
            <RouterTabs.Trigger href="/purchasing" exact>
              Drafts
            </RouterTabs.Trigger>
            <RouterTabs.Trigger href="/purchasing/completed">
              Completed
            </RouterTabs.Trigger>
          </RouterTabs.List>
        </RouterTabs>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <PurchaseOrdersTable list={list} initialParams={initialParams} />
      </ExplorerView.Content>
    </ExplorerView>
  );
}
