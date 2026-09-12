"use client";

import {
  listInternalOrganizationsTable,
  useListInternalOrganizations,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import { DataTable, type ListQueryParams } from "@dc-inventory/ui-internal";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { replaceTableUrlParams } from "../lib/table-url-params";
import {
  OrganizationDeleteDialog,
  type OrganizationRow,
} from "./organization-delete-dialog";

type OrganizationsListParams = NonNullable<
  Parameters<typeof useListInternalOrganizations>[0]
>;

const DEFAULT_ORGANIZATION_ID = "DEFAULT";

export function OrganizationsTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const [deletingOrganization, setDeletingOrganization] = useState<OrganizationRow | null>(null);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalOrganizationsTable, params);
  }, []);

  const rowActions = useCallback((row: Record<string, unknown>) => {
    const organization = row as OrganizationRow;
    if (typeof organization.id !== "string" || organization.id.length === 0) {
      return null;
    }
    if (organization.id === DEFAULT_ORGANIZATION_ID) {
      return null;
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDeletingOrganization(organization)}
      >
        <Trash2 className="size-icon" aria-hidden />
        Delete
      </Button>
    );
  }, []);

  return (
    <>
      <DataTable.Root<OrganizationsListParams>
        meta={listInternalOrganizationsTable}
        queryHook={useListInternalOrganizations}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        rowActions={rowActions}
        emptyMessage="No companies yet."
      >
        <DataTable.Toolbar>
          <DataTable.Search />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
      {deletingOrganization ? (
        <OrganizationDeleteDialog
          organization={deletingOrganization}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeletingOrganization(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
