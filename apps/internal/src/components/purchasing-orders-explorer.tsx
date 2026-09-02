"use client";

import { buttonVariants, ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OpenPurchaseOrderByDocumentNumber } from "./open-purchase-order-by-document-number";
import { PurchaseOrdersTable } from "./purchase-orders-table";

export function PurchasingOrdersExplorer({
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
          <div className="min-w-0 flex-1">
            <h1 className="page-title">Purchase orders</h1>
            <p className="page-description mt-2">
              Draft purchase orders stay editable here. Open a confirmed or received PO by
              document number, or browse inbound POs under Receiving.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-action">
            <Link
              href="/purchasing/suppliers"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Building2 className="size-icon-lg" aria-hidden />
              Suppliers
            </Link>
            <Link
              href="/purchasing/new"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              <Plus className="size-icon-lg" />
              New Draft PO
            </Link>
          </div>
        </header>
        <OpenPurchaseOrderByDocumentNumber />
      </ExplorerView.Header>
      <ExplorerView.Content>
        <PurchaseOrdersTable initialParams={initialParams} />
      </ExplorerView.Content>
    </ExplorerView>
  );
}
