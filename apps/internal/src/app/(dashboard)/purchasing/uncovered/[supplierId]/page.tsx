import { UncoveredFactoryDetail } from "../../../../../components/uncovered-factory-detail";
import { listParamsFromSearchParams } from "../../../../../lib/table-url-params";
import { uncoveredListTable } from "../../../../../lib/uncovered-list-table";

type UncoveredDetailSearchParams = Record<string, string | string[] | undefined>;

export default async function UncoveredFactoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ supplierId: string }>;
  searchParams: Promise<UncoveredDetailSearchParams>;
}) {
  const { supplierId } = await params;
  const initialParams = listParamsFromSearchParams(
    uncoveredListTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <UncoveredFactoryDetail factoryId={supplierId} initialParams={initialParams} />
    </section>
  );
}
