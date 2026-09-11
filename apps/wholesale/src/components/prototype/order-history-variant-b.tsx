"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoneyMinorUnits } from "../../lib/format-money";
import {
  formatOrderStatus,
  orderSubtotalCents,
  VISIBLE_ORDER_STATUSES,
} from "../../lib/order-history";
import {
  PROTOTYPE_ORDERS,
  prototypeOrderPath,
  type PrototypeOrder,
} from "../../lib/prototype/order-history-fixtures";
import { PrototypeOrderDetailBody } from "./prototype-order-detail-body";

const FILTERS = ["all", ...VISIBLE_ORDER_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

function statusTimeline(order: PrototypeOrder) {
  if (order.status === "cancelled") {
    return [
      { label: "Placed", done: true },
      { label: "Cancelled", done: true },
    ];
  }
  return [
    { label: "Placed", done: true },
    { label: "Confirmed", done: true },
    { label: "Shipped", done: order.status === "shipped" },
  ];
}

export function OrderHistoryVariantBList() {
  const [filter, setFilter] = useState<Filter>("all");
  const orders = useMemo(() => {
    if (filter === "all") {
      return PROTOTYPE_ORDERS;
    }
    return PROTOTYPE_ORDERS.filter((order) => order.status === filter);
  }, [filter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order status">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "shop-button-primary inline-flex items-center px-4 text-sm"
                : "shop-button-secondary inline-flex items-center px-4 text-sm"
            }
          >
            {key === "all" ? "All" : formatOrderStatus(key)}
          </button>
        ))}
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {orders.map((order) => {
          const href = prototypeOrderPath("b", order.documentNumber);
          const currency = order.lines[0]?.currency ?? "USD";
          return (
            <li key={order.documentNumber}>
              <Link
                href={href}
                className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-card p-5 hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{order.documentNumber}</p>
                    <p className="mt-1 text-sm text-ink-muted">{order.placedOn}</p>
                  </div>
                  <span className="inline-flex rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink">
                    {formatOrderStatus(order.status)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  {order.lines.length} {order.lines.length === 1 ? "item" : "items"} · Ship to{" "}
                  {order.shipCity}
                </p>
                <p className="mt-auto text-lg font-semibold text-ink">
                  {formatMoneyMinorUnits(orderSubtotalCents(order.lines), currency)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OrderHistoryVariantBDetail({ order }: { order: PrototypeOrder }) {
  const steps = statusTimeline(order);
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/order-history-prototype/b" className="hover:text-accent">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{order.documentNumber}</span>
      </nav>
      <header className="rounded-2xl border border-line bg-card px-6 py-8 text-center">
        <p className="section-title">Receipt</p>
        <h1 className="page-title mt-2">{order.documentNumber}</h1>
        <p className="mt-3 text-ink-muted">Placed {order.placedOn}</p>
        <p className="mt-4 inline-flex rounded-full border border-line px-4 py-1 text-sm font-semibold">
          {formatOrderStatus(order.status)}
        </p>
        <ol className="mt-6 flex justify-center gap-6 text-sm">
          {steps.map((step) => (
            <li key={step.label} className={step.done ? "font-semibold text-ink" : "text-ink-muted"}>
              {step.label}
            </li>
          ))}
        </ol>
      </header>
      <PrototypeOrderDetailBody order={order} />
    </article>
  );
}
