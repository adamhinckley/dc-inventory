"use client";

import {
  useGetWholesaleSalesOrderByDocumentNumber,
  type getWholesaleSalesOrderByDocumentNumber,
} from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";
import {
  formatOrderDate,
  formatOrderStatus,
  orderLineSubtotalCents,
  orderSubtotalCents,
} from "../lib/order-history";

type OrderDetail = Extract<
  Awaited<ReturnType<typeof getWholesaleSalesOrderByDocumentNumber>>["data"],
  { documentNumber: string }
>;

function OrderDetailLines({ order }: { order: OrderDetail }) {
  const currency = order.lines[0]?.currency ?? "USD";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Order lines</caption>
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Item</th>
            <th className="px-5 py-3 font-medium">SKU</th>
            <th className="px-5 py-3 text-right font-medium">Qty</th>
            <th className="px-5 py-3 text-right font-medium">Price</th>
            <th className="px-5 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-5 py-3 font-medium text-ink">{line.name}</td>
              <td className="px-5 py-3 text-ink-muted">{line.sku}</td>
              <td className="px-5 py-3 text-right text-ink">{line.qty}</td>
              <td className="px-5 py-3 text-right text-ink">
                {formatMoneyMinorUnits(line.unitPriceCents, line.currency)}
              </td>
              <td className="px-5 py-3 text-right text-ink">
                {formatMoneyMinorUnits(
                  orderLineSubtotalCents(line.qty, line.unitPriceCents),
                  line.currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-line px-5 py-4">
        <p className="text-sm font-semibold text-ink">Subtotal</p>
        <p className="text-base font-semibold text-ink">
          {formatMoneyMinorUnits(orderSubtotalCents(order.lines), currency)}
        </p>
      </div>
    </section>
  );
}

function OrderNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sold-out" role="alert">
        Order not found or unavailable for your account.
      </p>
      <Link href="/orders" className="shop-button-secondary inline-flex items-center text-sm">
        Back to Orders
      </Link>
    </div>
  );
}

export function OrderDetailView({ documentNumber }: { documentNumber: string }) {
  const order = useGetWholesaleSalesOrderByDocumentNumber(documentNumber);

  if (order.isPending) {
    return <p className="text-ink-muted">Loading order…</p>;
  }

  const payload = order.data?.data;
  if (order.isError || payload === undefined || !("documentNumber" in payload)) {
    return <OrderNotFound />;
  }

  return (
    <article className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/orders" className="hover:text-accent">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{payload.documentNumber}</span>
      </nav>
      <header>
        <p className="section-title">Order</p>
        <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-ink tabular-nums">
          {payload.documentNumber}
        </h1>
      </header>
      <section className="rounded-2xl border border-line bg-card p-5">
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-ink">Status</dt>
            <dd className="mt-2 text-sm text-ink-muted">{formatOrderStatus(payload.status)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Order Date</dt>
            <dd className="mt-2 text-sm text-ink-muted">{formatOrderDate(payload.confirmedAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Ship Date</dt>
            <dd className="mt-2 text-sm text-ink-muted">{formatOrderDate(payload.shippedAt)}</dd>
          </div>
          {payload.cancelledAt !== undefined ? (
            <div>
              <dt className="text-sm font-semibold text-ink">Cancelled</dt>
              <dd className="mt-2 text-sm text-ink-muted">{formatOrderDate(payload.cancelledAt)}</dd>
            </div>
          ) : null}
        </dl>
        {payload.shipLine1 ? (
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-ink">Ship To</h2>
            <p className="mt-2 text-sm text-ink-muted">
              <span className="block">{payload.shipLine1}</span>
              <span className="block">
                {payload.shipCity}, {payload.shipRegion} {payload.shipPostal}
              </span>
              <span className="block">{payload.shipCountry}</span>
            </p>
          </div>
        ) : null}
      </section>
      <OrderDetailLines order={payload} />
    </article>
  );
}
