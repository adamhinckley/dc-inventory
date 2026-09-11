import { OrderDetailView } from "../../../../components/order-detail-view";
import { ShopPage } from "../../../../components/shop-page";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ documentNumber: string }>;
}) {
  const { documentNumber } = await params;

  return (
    <ShopPage>
      <OrderDetailView documentNumber={decodeURIComponent(documentNumber)} />
    </ShopPage>
  );
}
