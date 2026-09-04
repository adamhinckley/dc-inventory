import { ShopPage } from "../../../components/shop-page";
import { ShopPlaceholder } from "../../../components/shop-placeholder";

export default function OrdersPage() {
  return (
    <ShopPage>
      <ShopPlaceholder
        title="Orders"
        body="Placeholder order history for the signed-in wholesale account."
      />
    </ShopPage>
  );
}
