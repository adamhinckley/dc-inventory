import { listInternalSalesOrdersTable } from "@dc-inventory/api-client-internal";
import { SalesOrdersTable } from "../../../components/sales-orders-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type SalesSearchParams = Record<string, string | string[] | undefined>;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SalesSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalSalesOrdersTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header>
        <h1 className="page-title">Sales orders</h1>
        <p className="page-description mt-2">
          Browse wholesale sales orders across draft, confirmed, shipped, and cancelled
          statuses. Open an order to review frozen prices, ship-to snapshot, and run
          confirm, cancel, or full ship.
        </p>
      </header>
      <SalesOrdersTable initialParams={initialParams} />
    </section>
  );
}
