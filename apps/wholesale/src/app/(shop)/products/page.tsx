import { Suspense } from "react";
import { ProductCardList } from "../../../components/product-card-list";
import { ShopPage } from "../../../components/shop-page";

export default function ProductsPage() {
  return (
    <ShopPage>
      <Suspense fallback={<p className="text-ink-muted">Loading catalog…</p>}>
        <ProductCardList />
      </Suspense>
    </ShopPage>
  );
}
