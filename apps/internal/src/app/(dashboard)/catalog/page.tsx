import { CatalogTable } from "../../../components/catalog-table";
import { productsListTable } from "../../../lib/products-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    productsListTable,
    await searchParams,
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-secondary">Catalog</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary">
          Products
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Staff product list from the internal API. Quantities are displayed as
          returned — this page does not write inventory.
        </p>
      </header>
      <CatalogTable initialParams={initialParams} />
    </section>
  );
}
