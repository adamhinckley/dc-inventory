"use client";

import { buttonVariants } from "@dc-inventory/ui";
import { ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import Link from "next/link";
import type { ReactNode } from "react";
import { DraftPurchaseOrdersTable } from "./draft-purchase-orders-table";

export function PurchasingDraftsExplorer({
  initialParams,
  children,
}: {
  initialParams?: ListQueryParams;
  children?: ReactNode;
}) {
  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        {children}
        <header className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-label text-fg-secondary">Purchasing</p>
            <h1 className="page-title mt-1">Draft purchase orders</h1>
            <p className="page-description mt-2">
              Reopen in-progress POs, build new drafts from vendor catalogs, finalize
              with confirm, and download XLS from the workspace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-tight">
            <Link
              href="/purchasing/suppliers"
              className="text-body-sm text-link hover:text-link-hover"
            >
              Suppliers
            </Link>
            <Link
              href="/purchasing/new"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              New draft PO
            </Link>
          </div>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <DraftPurchaseOrdersTable initialParams={initialParams} />
      </ExplorerView.Content>
    </ExplorerView>
  );
}
