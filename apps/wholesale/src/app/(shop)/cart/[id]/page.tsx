import { CartView } from "../../../../components/cart-view";
import { ShopPage } from "../../../../components/shop-page";

export default async function CartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ShopPage>
      <CartView cartId={id} />
    </ShopPage>
  );
}
