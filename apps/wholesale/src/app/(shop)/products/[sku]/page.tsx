import { Suspense } from "react";
import { ProductDetail } from "../../../../components/product-detail";
import { ShopPage } from "../../../../components/shop-page";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku: productId } = await params;

  return (
    <ShopPage>
      <Suspense fallback={<p className="text-ink-muted">Loading product…</p>}>
        <ProductDetail productId={productId} />
      </Suspense>
    </ShopPage>
  );
}
