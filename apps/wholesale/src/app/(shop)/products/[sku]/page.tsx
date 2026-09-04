import { ShopPage } from "../../../../components/shop-page";
import { ShopPlaceholder } from "../../../../components/shop-placeholder";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku: productId } = await params;

  return (
    <ShopPage>
      <ShopPlaceholder
        title="Product"
        body={`Placeholder product detail for ${productId}. A catalog-by-id Orval hook is not on the stub yet.`}
      />
    </ShopPage>
  );
}
