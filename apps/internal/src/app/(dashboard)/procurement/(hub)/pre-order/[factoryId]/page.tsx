import { Purchasing2UncoveredDetail } from "../../../../../../components/purchasing-2-uncovered-detail";
import { listParamsFromSearchParams } from "../../../../../../lib/table-url-params";
import { uncoveredListTable } from "../../../../../../lib/uncovered-list-table";

type PreOrderDetailSearchParams = Record<string, string | string[] | undefined>;

export default async function ProcurementPreOrderFactoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<PreOrderDetailSearchParams>;
}) {
  const { factoryId } = await params;
  const initialParams = listParamsFromSearchParams(
    uncoveredListTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <Purchasing2UncoveredDetail factoryId={factoryId} initialParams={initialParams} />
    </section>
  );
}
