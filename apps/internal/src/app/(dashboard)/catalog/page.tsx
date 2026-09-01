import { CatalogHeading } from "../../../components/catalog-heading";
import { CatalogTable } from "../../../components/catalog-table";
import { catalogListTable } from "../../../lib/catalog-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    catalogListTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <CatalogHeading />
      <CatalogTable initialParams={initialParams} />
    </section>
  );
}
