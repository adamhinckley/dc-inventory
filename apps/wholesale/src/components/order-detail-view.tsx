"use client";

import { useGetWholesaleSalesOrderByDocumentNumber } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";
import {
  formatOrderStatus,
  isVisibleOrderStatus,
  orderLineSubtotalCents,
  orderSubtotalCents,
} from "../lib/order-history";

function shipToLines(order: {
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
}): string[] {
  const lines = [order.shipLine1, order.shipLine2].filter(
    (line): line is string => typeof line === "string" && line.trim().length > 0,
  );
  const cityLine = [order.shipCity, order.shipRegion, order.shipPostal]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");
  if (cityLine.length > 0) {
    lines.push(cityLine);
  }
  if (order.shipCountry !== undefined && order.shipCountry.trim().length > 0) {
    lines.push(order.shipCountry);
  }
  return lines;
}

export function OrderDetailView({ documentNumber }: { documentNumber: string }) {
  const query = useGetWholesaleSalesOrderByDocumentNumber(documentNumber);
  const payload = query.data?.status === 200 ? query.data.data : null;

  if (query.isPending) {
    return <p className="text-ink-muted">Loading order…</p>;
  }

  if (query.isError || payload === null || !isVisibleOrderStatus(payload.status)) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sold-out" role="alert">
          This order is not in your history.
        </p>
        <Link href="/orders" className="shop-button-secondary inline-flex items-center text-sm">
          Back to Orders
        </Link>
      </div>
    );
  }

  const currency = payload.lines[0]?.currency ?? "USD";
  const subtotalCents = orderSubtotalCents(payload.lines);
  const address = shipToLines(payload);

  return (
    <article className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/orders" className="hover:text-accent">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{payload.documentNumber}</span>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Order</p>
          <h1 className="page-title mt-2">{payload.documentNumber}</h1>
        </div>
        <p className="inline-flex w-fit rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink">
          {formatOrderStatus(payload.status)}
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-ink">Ship To</h2>
        {address.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No ship-to was captured on this order.</p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            {address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        )}
      </section>

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
            {payload.lines.map((line) => (
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
            {formatMoneyMinorUnits(subtotalCents, currency)}
          </p>
        </div>
      </section>
    </article>
  );
}
