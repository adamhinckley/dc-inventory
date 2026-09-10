"use client";

import {
  listInternalSuppliersTable,
  useListInternalSuppliers,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { replaceTableUrlParams } from "../lib/table-url-params";
import type { SupplierRow } from "../lib/supplier-types";
import { SupplierEditDialog } from "./supplier-edit-dialog";

type SuppliersListParams = NonNullable<
  Parameters<typeof useListInternalSuppliers>[0]
>;

export function SuppliersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(
    null,
  );

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalSuppliersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/purchasing/suppliers/${row.id}` : undefined;
  }, []);

  const rowActions = useCallback((row: Record<string, unknown>) => {
    const supplier = row as SupplierRow;
    if (typeof supplier.id !== "string" || supplier.id.length === 0) {
      return null;
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditingSupplier(supplier)}
      >
        <Pencil className="size-icon" aria-hidden />
        Edit
      </Button>
    );
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
      <DataTable.Root<SuppliersListParams>
        meta={listInternalSuppliersTable}
        queryHook={useListInternalSuppliers}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        getRowHref={getRowHref}
        linkField="vendorNumber"
        renderRowLink={renderRowLink}
        rowActions={rowActions}
      >
        <DataTable.Toolbar>
          <DataTable.Search />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
      {editingSupplier ? (
        <SupplierEditDialog
          supplier={editingSupplier}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditingSupplier(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
