import { ProductCardList } from "../../../components/product-card-list";

export default function ProductsPage() {
  return (
    <section className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">
          Catalog
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Products
        </h1>
        <p className="mt-2 text-ink-muted">
          Wholesale prices and availability from the catalog API. Availability is
          displayed as returned — this page does not compute stock.
        </p>
      </header>
      <ProductCardList />
    </section>
  );
}
