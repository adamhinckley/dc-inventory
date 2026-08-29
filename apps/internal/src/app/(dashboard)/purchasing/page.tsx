import { listInternalPurchaseOrdersTable } from "@dc-inventory/api-client-internal";
import { PurchasingDraftsExplorer } from "../../../components/purchasing-drafts-explorer";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type PurchasingSearchParams = Record<string, string | string[] | undefined>;

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<PurchasingSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalPurchaseOrdersTable,
    await searchParams,
  );

  return <PurchasingDraftsExplorer initialParams={initialParams} />;
}
