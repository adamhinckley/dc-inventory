import Link from "next/link";
import { formatMoneyMinorUnits } from "../../lib/format-money";
import { formatOrderStatus, orderSubtotalCents } from "../../lib/order-history";
import {
  PROTOTYPE_ORDERS,
  prototypeOrderPath,
  type PrototypeOrder,
} from "../../lib/prototype/order-history-fixtures";
import { PrototypeOrderDetailBody } from "./prototype-order-detail-body";

export function OrderHistoryVariantAList() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <ul className="divide-y divide-line">
        {PROTOTYPE_ORDERS.map((order) => {
          const href = prototypeOrderPath("a", order.documentNumber);
          const currency = order.lines[0]?.currency ?? "USD";
          return (
            <li key={order.documentNumber}>
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={href} className="font-semibold text-ink hover:text-accent">
                    {order.documentNumber}
                  </Link>
                  <p className="text-sm text-ink-muted">{formatOrderStatus(order.status)}</p>
                  <p className="text-sm text-ink-muted">
                    Ship to {order.shipLine1}, {order.shipCity}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <p className="text-base font-medium text-ink">
                    {formatMoneyMinorUnits(orderSubtotalCents(order.lines), currency)}
                  </p>
                  <Link
                    href={href}
                    className="shop-button-secondary inline-flex min-h-10 items-center px-4 text-sm"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OrderHistoryVariantADetail({ order }: { order: PrototypeOrder }) {
  return (
    <article className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/order-history-prototype/a" className="hover:text-accent">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{order.documentNumber}</span>
      </nav>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Order</p>
          <h1 className="page-title mt-2">{order.documentNumber}</h1>
        </div>
        <p className="inline-flex w-fit rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink">
          {formatOrderStatus(order.status)}
        </p>
      </header>
      <PrototypeOrderDetailBody order={order} />
    </article>
  );
}
