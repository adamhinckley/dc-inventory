import { CatalogTable } from "../../../components/catalog-table";

export default function CatalogPage() {
  return (
    <section className="flex flex-col gap-region">
      <header className="max-w-2xl">
        <p className="text-label text-fg-secondary">Catalog</p>
        <h1 className="page-title mt-1">Products</h1>
        <p className="page-description mt-2">
          Staff product list from the internal API. Quantities are displayed as
          returned — this page does not write inventory.
        </p>
      </header>
      <CatalogTable />
    </section>
  );
}
