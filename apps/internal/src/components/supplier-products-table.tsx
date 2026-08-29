"use client";

import {
  listInternalSupplierProductsTable,
  useListInternalSupplierProducts,
} from "@dc-inventory/api-client-internal";
import { Button } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useCallback, useMemo, useState } from "react";
import type {
  SupplierProductRow,
  SupplierProductsListParams,
} from "../lib/supplier-product-types";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { SupplierProductEditDialog } from "./supplier-product-edit-dialog";
import { SupplierProductUnlinkButton } from "./supplier-product-unlink-button";

function createSupplierProductsHook(
  supplierId: string,
): ListQueryHook<SupplierProductsListParams> {
  return function useSupplierProductsList(params) {
    return useListInternalSupplierProducts(supplierId, params);
  };
}

export function SupplierProductsTable({
  supplierId,
  initialParams,
}: {
  supplierId: string;
  initialParams?: ListQueryParams;
}) {
  const [editingProduct, setEditingProduct] = useState<SupplierProductRow | null>(
    null,
  );

  const queryHook = useMemo(
    () => createSupplierProductsHook(supplierId),
    [supplierId],
  );

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalSupplierProductsTable, params);
  }, []);

  const rowActions = useCallback(
    (row: Record<string, unknown>) => {
      const product = row as SupplierProductRow;
      return (
        <div className="flex items-center gap-tight">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditingProduct(product)}
          >
            Edit
          </Button>
          <SupplierProductUnlinkButton supplierId={supplierId} product={product} />
        </div>
      );
    },
    [supplierId],
  );

  return (
    <>
      <DataTable.Root<SupplierProductsListParams>
        meta={listInternalSupplierProductsTable}
        queryHook={queryHook}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        rowActions={rowActions}
        idPrefix={`supplier-${supplierId}-products`}
      >
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
      {editingProduct ? (
        <SupplierProductEditDialog
          supplierId={supplierId}
          product={editingProduct}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditingProduct(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
