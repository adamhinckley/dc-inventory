import { CreatePurchaseOrderForm } from "../../../components/create-purchase-order-form";
import { PurchaseOrdersTable } from "../../../components/purchase-orders-table";
import { purchaseOrdersListTable } from "../../../lib/purchase-orders-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type PurchasingSearchParams = Record<string, string | string[] | undefined>;

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<PurchasingSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    purchaseOrdersListTable,
    await searchParams,
  );

  return (
    <section className="flex flex-col gap-region">
      <header className="max-w-2xl">
        <p className="text-label text-fg-secondary">Purchasing</p>
        <h1 className="page-title mt-1">Purchase orders</h1>
        <p className="page-description mt-2">
          Create a draft PO, then confirm and receive it later. After{" "}
          <code>pnpm db:seed:phase1</code>, pick <code>VEND-001</code> and a
          catalog SKU such as <code>HEX-BOLT-GALV</code>.
        </p>
      </header>
      <CreatePurchaseOrderForm />
      <PurchaseOrdersTable initialParams={initialParams} />
    </section>
  );
}
