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
      <ProductDetail productId={productId} />
    </ShopPage>
  );
}
