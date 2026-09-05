import { InventoryStockTable } from "../../../components/inventory-table";
import { inventoryListInitialParams } from "../../../lib/inventory-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type InventorySearchParams = Record<string, string | string[] | undefined>;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const initialParams = inventoryListInitialParams(
    await searchParams,
    listParamsFromSearchParams,
  );

  return <InventoryStockTable initialParams={initialParams} />;
}
