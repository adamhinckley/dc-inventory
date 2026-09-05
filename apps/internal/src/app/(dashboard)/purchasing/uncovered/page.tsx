import { UncoveredSkusTable } from "../../../../components/uncovered-skus-table";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";
import { uncoveredListTable } from "../../../../lib/uncovered-list-table";

type UncoveredSearchParams = Record<string, string | string[] | undefined>;

export default async function UncoveredSkusPage({
  searchParams,
}: {
  searchParams: Promise<UncoveredSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    uncoveredListTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header>
        <h1 className="page-title">Uncovered SKUs</h1>
        <p className="page-description mt-2">
          Factory to-order need with on-hand, inbound PO, and reorder context.
          Suggested qty rounds uncovered demand up to the master pack.
        </p>
      </header>
      <UncoveredSkusTable initialParams={initialParams} />
    </section>
  );
}
