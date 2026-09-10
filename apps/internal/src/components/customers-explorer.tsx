"use client";

import { ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { CustomerCreateForm } from "./customer-create-form";
import { CustomersTable } from "./customers-table";
import { useCanManageMasterData } from "../lib/staff-master-data-manage";

export function CustomersExplorer({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const canManage = useCanManageMasterData();

  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <header className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="page-title">Customers</h1>
          </div>
          {canManage ? (
            <div className="shrink-0">
              <ExplorerView.CreateButton>Create Customer</ExplorerView.CreateButton>
            </div>
          ) : null}
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <CustomersTable initialParams={initialParams} />
      </ExplorerView.Content>
      {canManage ? (
        <ExplorerView.CreateDialog title="Create customer">
          <CustomerCreateForm />
        </ExplorerView.CreateDialog>
      ) : null}
    </ExplorerView>
  );
}
