import { listInternalPurchaseOrdersTable } from "@dc-inventory/api-client-internal";
import { PurchasingOrdersExplorer } from "../../../../../components/purchasing-orders-explorer";
import { listParamsFromSearchParams } from "../../../../../lib/table-url-params";

type PurchaseOrdersSearchParams = Record<string, string | string[] | undefined>;

export default async function ProcurementPurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<PurchaseOrdersSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalPurchaseOrdersTable,
    await searchParams,
  );

  return <PurchasingOrdersExplorer initialParams={initialParams} />;
}
