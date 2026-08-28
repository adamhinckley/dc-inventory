import { CatalogImportDialog } from "../../../components/catalog-import-dialog";
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
    <section className="flex flex-col gap-region">
      <header className="flex flex-wrap items-end justify-between gap-field-group">
        <div className="max-w-2xl">
          <p className="text-label text-fg-secondary">Catalog</p>
          <h1 className="page-title mt-1">Products</h1>
          <p className="page-description mt-2">
            Staff product list from the internal API. Quantities are displayed as
            returned — this page does not write inventory.
          </p>
        </div>
        <CatalogImportDialog />
      </header>
      <CatalogTable initialParams={initialParams} />
    </section>
  );
}
