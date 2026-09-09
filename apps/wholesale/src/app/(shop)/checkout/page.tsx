import { Suspense } from "react";
import { CheckoutView } from "../../../components/checkout-view";
import { ShopPage } from "../../../components/shop-page";

export default function CheckoutPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Checkout</p>
          <h1 className="page-title mt-2">Confirm Your Order</h1>
          <p className="mt-3 text-ink-muted">
            Choose a ship-to address and confirm this cart as a sales order.
          </p>
        </header>
        <Suspense fallback={<p className="text-ink-muted">Loading checkout…</p>}>
          <CheckoutView />
        </Suspense>
      </section>
    </ShopPage>
  );
}
