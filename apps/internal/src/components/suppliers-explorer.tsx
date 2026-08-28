"use client";

import { ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import type { ReactNode } from "react";
import { SupplierCreateForm } from "./supplier-create-form";
import { SuppliersTable } from "./suppliers-table";

export function SuppliersExplorer({
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
            <h1 className="page-title mt-1">Suppliers</h1>
            <p className="page-description mt-2">
              Maintain vendor records and the catalog SKUs each supplier sells.
            </p>
          </div>
          <div className="shrink-0">
            <ExplorerView.CreateButton>New supplier</ExplorerView.CreateButton>
          </div>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <SuppliersTable initialParams={initialParams} />
      </ExplorerView.Content>
      <ExplorerView.CreateDialog title="New supplier">
        <SupplierCreateForm />
      </ExplorerView.CreateDialog>
    </ExplorerView>
  );
}
