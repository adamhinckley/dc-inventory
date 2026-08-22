import { ShopPlaceholder } from "../../../../components/shop-placeholder";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku: productId } = await params;

  return (
    <ShopPlaceholder
      title="Product"
      body={`Placeholder product detail for ${productId}. A catalog-by-id Orval hook is not on the stub yet.`}
    />
  );
}
