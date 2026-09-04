import { Suspense } from "react";
import { ProductCardList } from "../../../components/product-card-list";
import { ShopPage } from "../../../components/shop-page";

export default function ProductsPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Catalog</p>
          <h1 className="page-title mt-2">Products</h1>
          <p className="mt-3 text-ink-muted">
            Wholesale prices and availability from the catalog API. Use Available
            only and pagination to browse what you can order today.
          </p>
        </header>
        <Suspense fallback={<p className="text-ink-muted">Loading catalog…</p>}>
          <ProductCardList />
        </Suspense>
      </section>
    </ShopPage>
  );
}
