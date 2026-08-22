import { CatalogTable } from "../../../components/catalog-table";

export default function CatalogPage() {
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
      <CatalogTable />
    </section>
  );
}
