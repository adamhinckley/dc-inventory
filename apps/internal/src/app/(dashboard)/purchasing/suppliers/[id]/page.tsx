import { SupplierDetailPage } from "../../../../../components/supplier-detail-page";
import { supplierProductsListTable } from "../../../../../lib/supplier-products-list-table";
import { listParamsFromSearchParams } from "../../../../../lib/table-url-params";

type SupplierDetailSearchParams = Record<string, string | string[] | undefined>;

export default async function SupplierDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SupplierDetailSearchParams>;
}) {
  const { id } = await params;
  const initialProductParams = listParamsFromSearchParams(
    supplierProductsListTable,
    await searchParams,
  );

  return (
    <SupplierDetailPage
      supplierId={id}
      initialProductParams={initialProductParams}
    />
  );
}
