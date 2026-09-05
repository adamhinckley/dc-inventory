"use client";

import {
  useListInternalProducts,
} from "@dc-inventory/api-client-internal";
import {
  DataTable,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useCallback, useState } from "react";
import { catalogListTable } from "../lib/catalog-list-table";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { useProductListFilterOptions } from "../lib/use-product-list-filter-options";
import { CatalogCsvDownloadButton } from "./catalog-csv-download-button";
import { CatalogImportDialog } from "./catalog-import-dialog";
import { CatalogProductEditDialog } from "./catalog-product-edit-dialog";
import { CatalogProductRowMenu } from "./catalog-product-row-menu";

type CatalogListParams = NonNullable<
  Parameters<typeof useListInternalProducts>[0]
>;

export function CatalogTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(catalogListTable, params);
  }, []);
  const filterOptions = useProductListFilterOptions();

  const rowActions = useCallback((row: Record<string, unknown>) => {
    const id = typeof row.id === "string" ? row.id : "";
    const sku = typeof row.sku === "string" ? row.sku : "product";
    if (id === "") {
      return null;
    }
    return (
      <CatalogProductRowMenu
        sku={sku}
        onEdit={() => setEditingProductId(id)}
      />
    );
  }, []);

  return (
    <>
      <DataTable.Root<CatalogListParams>
        meta={catalogListTable}
        queryHook={useListInternalProducts}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        filterOptions={filterOptions}
        filterLabels={{
          inactive: "Inactive",
          category: "Category",
          supplierId: "Factory",
        }}
        rowActions={rowActions}
      >
        <DataTable.Toolbar>
          <DataTable.FilterBar resource="Product" />
          <CatalogCsvDownloadButton />
          <CatalogImportDialog />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
      {editingProductId ? (
        <CatalogProductEditDialog
          productId={editingProductId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditingProductId(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
