import { CartView } from "../../../components/cart-view";
import { ShopPage } from "../../../components/shop-page";

export default function CartPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Cart</p>
          <h1 className="page-title mt-2">Your Cart</h1>
          <p className="mt-3 text-ink-muted">
            One draft sales order per account. Quantities and availability stay on
            the server.
          </p>
        </header>
        <CartView />
      </section>
    </ShopPage>
  );
}
