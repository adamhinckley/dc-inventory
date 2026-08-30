import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import { CatalogCsvDownloadButton } from "../../../components/catalog-csv-download-button";
import { CatalogImportDialog } from "../../../components/catalog-import-dialog";
import { CatalogTable } from "../../../components/catalog-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalProductsTable,
    await searchParams,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-field-group">
        <div className="max-w-2xl">
          <p className="text-label text-fg-secondary">Catalog</p>
          <h1 className="page-title mt-1">Products</h1>
          <p className="page-description mt-2">
            Staff product list from the internal API. Quantities are displayed as
            returned — this page does not write inventory.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-field-group">
          <CatalogCsvDownloadButton />
          <CatalogImportDialog />
        </div>
      </header>
      <CatalogTable initialParams={initialParams} />
    </section>
  );
}
