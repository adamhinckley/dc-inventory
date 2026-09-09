import { CartsList } from "../../../components/carts-list";
import { ShopPage } from "../../../components/shop-page";

export default function CartPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Cart</p>
          <h1 className="page-title mt-2">Your Carts</h1>
          <p className="mt-3 text-ink-muted">
            Keep as many carts open as you like — one per season, store, or buyer.
            Each is a draft order until you check it out.
          </p>
        </header>
        <CartsList />
      </section>
    </ShopPage>
  );
}
