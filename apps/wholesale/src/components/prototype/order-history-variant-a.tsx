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
      <header>
        <p className="section-title">Order</p>
        <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-ink tabular-nums">
          {order.documentNumber}
        </h1>
      </header>
      <section className="rounded-2xl border border-line bg-card p-5">
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-ink">Status</dt>
            <dd className="mt-2 text-sm text-ink-muted">{formatOrderStatus(order.status)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Order Date</dt>
            <dd className="mt-2 text-sm text-ink-muted">{order.placedOn}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Ship Date</dt>
            <dd className="mt-2 text-sm text-ink-muted">{order.shippedOn ?? "—"}</dd>
          </div>
          {order.cancelledOn !== undefined ? (
            <div>
              <dt className="text-sm font-semibold text-ink">Cancelled</dt>
              <dd className="mt-2 text-sm text-ink-muted">{order.cancelledOn}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-sm font-semibold text-ink">Ship To</h2>
          <p className="mt-2 text-sm text-ink-muted">
            <span className="block">{order.shipLine1}</span>
            <span className="block">
              {order.shipCity}, {order.shipRegion} {order.shipPostal}
            </span>
            <span className="block">{order.shipCountry}</span>
          </p>
        </div>
      </section>
      <PrototypeOrderDetailBody order={order} showShipTo={false} />
    </article>
  );
}
