import { PurchasingOrdersExplorer } from "../../../components/purchasing-orders-explorer";
import { draftPurchaseOrdersListTable } from "../../../lib/draft-purchase-orders-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type PurchasingSearchParams = Record<string, string | string[] | undefined>;

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<PurchasingSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    draftPurchaseOrdersListTable,
    await searchParams,
  );

  return <PurchasingOrdersExplorer list="draft" initialParams={initialParams} />;
}
