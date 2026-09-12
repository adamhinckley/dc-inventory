"use client";

import {
  listInternalCustomersTable,
  useListInternalCustomers,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import {
  customerListAccountStatusLabel,
} from "../lib/customer-account-status";
import { customerAccountStatusFilterOptions } from "../lib/customer-account-status-filter";
import type { CustomerAccountStatus } from "../lib/customer-types";
import { useCanManageMasterData } from "../lib/staff-master-data-manage";
import { replaceTableUrlParams } from "../lib/table-url-params";
import {
  CustomerDeleteDialog,
  type CustomerDeleteRow,
} from "./customer-delete-dialog";

type CustomersListParams = NonNullable<
  Parameters<typeof useListInternalCustomers>[0]
>;

export function CustomersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const canManage = useCanManageMasterData();
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerDeleteRow | null>(null);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalCustomersTable, params);
  }, []);

  const rowActions = useCallback(
    (row: Record<string, unknown>) => {
      if (!canManage) {
        return null;
      }
      const customer = row as CustomerDeleteRow;
      if (typeof customer.id !== "string" || customer.id.length === 0) {
        return null;
      }
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDeletingCustomer(customer)}
        >
          <Trash2 className="size-icon" aria-hidden />
          Delete
        </Button>
      );
    },
    [canManage],
  );

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/customers/${row.id}` : undefined;
  }, []);

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  return (
    <>
      <DataTable.Root<CustomersListParams>
        meta={listInternalCustomersTable}
        queryHook={useListInternalCustomers}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        getRowHref={getRowHref}
        linkField="name"
        renderRowLink={renderRowLink}
        rowActions={rowActions}
        filterOptions={{ accountStatus: customerAccountStatusFilterOptions }}
        filterLabels={{ accountStatus: "Status" }}
        emptyMessage="No customers yet."
        renderColumns={{
          accountStatus: (row) =>
            customerListAccountStatusLabel(
              row.accountStatus as CustomerAccountStatus,
            ),
        }}
      >
        <DataTable.Toolbar>
          <DataTable.FilterBar resource="Customer" pinned={["accountStatus"]} />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
      {deletingCustomer ? (
        <CustomerDeleteDialog
          customer={deletingCustomer}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeletingCustomer(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
