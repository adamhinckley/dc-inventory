import { ShopPage } from "../../../components/shop-page";
import { ShopPlaceholder } from "../../../components/shop-placeholder";

export default function CartPage() {
  return (
    <ShopPage>
      <ShopPlaceholder
        title="Cart"
        body="Placeholder cart. Quantity and availability stay on the server — this app will not invent stock in the browser."
      />
    </ShopPage>
  );
}
