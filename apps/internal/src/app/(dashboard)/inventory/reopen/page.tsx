import { InventoryReopenReview } from "../../../../components/inventory-reopen-review";
import { InventoryTableChrome } from "../../../../components/inventory-table";
import { inventoryListInitialParams } from "../../../../lib/inventory-list-table";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";
import { isSellWindowsPrototypeVariant } from "../../../../prototype/sell-windows/prototype-href";
import { SellWindowsListPage } from "../../../../prototype/sell-windows/pages/windows-list-page";

type InventorySearchParams = Record<string, string | string[] | undefined>;

function readVariant(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isSellWindowsPrototypeVariant(raw ?? null) ? (raw ?? null) : null;
}

export default async function InventoryReopenPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const resolved = await searchParams;

  if (readVariant(resolved.variant) !== null) {
    return <SellWindowsListPage />;
  }

  const initialParams = inventoryListInitialParams(resolved, listParamsFromSearchParams);

  return (
    <InventoryTableChrome initialParams={initialParams}>
      <InventoryReopenReview />
    </InventoryTableChrome>
  );
}
