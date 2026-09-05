import { InventoryReopenReview } from "../../../../components/inventory-reopen-review";
import { InventoryTableChrome } from "../../../../components/inventory-table";
import { inventoryListInitialParams } from "../../../../lib/inventory-list-table";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";

type InventorySearchParams = Record<string, string | string[] | undefined>;

export default async function InventoryReopenPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const initialParams = inventoryListInitialParams(
    await searchParams,
    listParamsFromSearchParams,
  );

  return (
    <InventoryTableChrome initialParams={initialParams}>
      <InventoryReopenReview />
    </InventoryTableChrome>
  );
}
