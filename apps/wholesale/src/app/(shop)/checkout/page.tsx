import { ShopPage } from "../../../components/shop-page";
import { ShopPlaceholder } from "../../../components/shop-placeholder";

export default function CheckoutPage() {
  return (
    <ShopPage>
      <ShopPlaceholder
        title="Checkout"
        body="Placeholder checkout. Tax will display from a quoted API total only — never price × rate in the shop."
      />
    </ShopPage>
  );
}
