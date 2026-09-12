"use client";

import { ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { OrganizationCreateForm } from "./organization-create-form";
import { OrganizationsTable } from "./organizations-table";

export function OrganizationsExplorer({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <header className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="page-kicker">Platform</p>
            <h1 className="page-title">Companies</h1>
            <p className="page-description mt-2">
              Provision wholesale companies and invite their first admin.
            </p>
          </div>
          <div className="shrink-0">
            <ExplorerView.CreateButton>Add Company</ExplorerView.CreateButton>
          </div>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <OrganizationsTable initialParams={initialParams} />
      </ExplorerView.Content>
      <ExplorerView.CreateDialog title="Add Company" data-testid="organizations-create-dialog">
        <OrganizationCreateForm />
      </ExplorerView.CreateDialog>
    </ExplorerView>
  );
}
