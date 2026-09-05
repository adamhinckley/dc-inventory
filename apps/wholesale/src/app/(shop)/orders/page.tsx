import { OrdersHistoryView } from "../../../components/orders-history-view";
import { ShopPage } from "../../../components/shop-page";

export default function OrdersPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Orders</p>
          <h1 className="page-title mt-2">Order History</h1>
          <p className="mt-3 text-ink-muted">
            Confirmed, shipped, and cancelled orders for your account. Draft carts stay on the cart page.
          </p>
        </header>
        <OrdersHistoryView />
      </section>
    </ShopPage>
  );
}
