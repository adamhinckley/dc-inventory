import { listInternalSupplierProductsTable } from "@dc-inventory/api-client-internal";
import { SupplierDetailPage } from "../../../../../../components/supplier-detail-page";
import { listParamsFromSearchParams } from "../../../../../../lib/table-url-params";

type SupplierDetailSearchParams = Record<string, string | string[] | undefined>;

export default async function ProcurementSupplierDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SupplierDetailSearchParams>;
}) {
  const { id } = await params;
  const initialProductParams = listParamsFromSearchParams(
    listInternalSupplierProductsTable,
    await searchParams,
  );

  return (
    <SupplierDetailPage
      supplierId={id}
      initialProductParams={initialProductParams}
    />
  );
}
