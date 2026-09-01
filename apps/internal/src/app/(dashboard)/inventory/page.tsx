import { InventoryHeading } from "../../../components/inventory-heading";
import { InventoryTable } from "../../../components/inventory-table";
import {
  inventoryListInitialParams,
  inventoryListTable,
} from "../../../lib/inventory-list-table";
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

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <InventoryHeading />
      <InventoryTable initialParams={initialParams} />
    </section>
  );
}
