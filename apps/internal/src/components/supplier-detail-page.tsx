"use client";

import { useGetInternalSupplier } from "@dc-inventory/api-client-internal";
import { DetailView, ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import type { SupplierDetail } from "../lib/supplier-types";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import { SupplierEditForm } from "./supplier-edit-form";
import { SupplierProductAssignForm } from "./supplier-product-assign-form";
import { SupplierProductsTable } from "./supplier-products-table";

export function SupplierDetailPage({
  supplierId,
  initialProductParams,
}: {
  supplierId: string;
  initialProductParams?: ListQueryParams;
}) {
  const query = useGetInternalSupplier(supplierId);
  const supplier = query.data?.status === 200 ? query.data.data : undefined;
  useBreadcrumbLabel(supplierId, supplier?.vendorNumber);

  return (
    <DetailView<SupplierDetail>
      loading={query.isLoading}
      error={query.isError ? query.error : undefined}
      data={supplier}
    >
      {(loaded) => (
        <>
          <DetailView.Header>
            <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="page-title">{loaded.name}</h1>
                <p className="page-description mt-1 tabular-nums">
                  Vendor #{loaded.vendorNumber}
                </p>
              </div>
              <DetailView.EditButton>Edit Supplier</DetailView.EditButton>
            </header>
          </DetailView.Header>
          <DetailView.Summary>
            <dl className="grid gap-field-group sm:grid-cols-2">
              <div>
                <dt className="text-label text-fg-secondary">Vendor #</dt>
                <dd className="mt-1 tabular-nums">{loaded.vendorNumber}</dd>
              </div>
              <div>
                <dt className="text-label text-fg-secondary">Name</dt>
                <dd className="mt-1">{loaded.name}</dd>
              </div>
              <div>
                <dt className="text-label text-fg-secondary">PO prefix</dt>
                <dd className="mt-1 tabular-nums">{loaded.poPrefix ?? "—"}</dd>
              </div>
            </dl>
          </DetailView.Summary>
          <DetailView.Tabs>
            <ExplorerView className="min-h-[28rem]">
              <ExplorerView.Header>
                <header className="flex flex-col gap-region sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-heading-sm">Vendor SKUs</h2>
                    <p className="text-body-sm text-fg-secondary mt-1">
                      Catalog SKUs this vendor sells, with terms and on-hand quantities
                      from the API.
                    </p>
                  </div>
                  <ExplorerView.CreateButton>Assign SKU</ExplorerView.CreateButton>
                </header>
              </ExplorerView.Header>
              <ExplorerView.Content>
                <SupplierProductsTable
                  supplierId={loaded.id}
                  initialParams={initialProductParams}
                />
              </ExplorerView.Content>
              <ExplorerView.CreateDialog title="Assign catalog SKU">
                <SupplierProductAssignForm supplierId={loaded.id} />
              </ExplorerView.CreateDialog>
            </ExplorerView>
          </DetailView.Tabs>
          <DetailView.EditDialog title="Edit supplier">
            <SupplierEditForm supplier={loaded} />
          </DetailView.EditDialog>
        </>
      )}
    </DetailView>
  );
}
