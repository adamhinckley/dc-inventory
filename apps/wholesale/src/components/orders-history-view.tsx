"use client";

import { useListWholesaleSalesOrders } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { useMemo } from "react";
import { formatMoneyMinorUnits } from "../lib/format-money";
import {
  formatOrderStatus,
  isVisibleOrderStatus,
  orderHistoryPath,
  orderSubtotalCents,
} from "../lib/order-history";

const PAGE_SIZE = 50;

export function OrdersHistoryView() {
  const orders = useListWholesaleSalesOrders({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "documentNumber",
    sortOrder: "desc",
  });

  const visibleOrders = useMemo(() => {
    const payload = orders.data?.data;
    const items = payload && "items" in payload ? payload.items : [];
    return items
      .filter((order) => isVisibleOrderStatus(order.status))
      .sort((left, right) => right.documentNumber.localeCompare(left.documentNumber));
  }, [orders.data?.data]);

  if (orders.isPending) {
    return <p className="text-ink-muted">Loading orders…</p>;
  }

  if (orders.isError) {
    return (
      <p className="text-sold-out" role="alert">
        Order history is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  if (visibleOrders.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">No confirmed orders yet.</p>
        <Link
          href="/products"
          className="inline-flex w-fit rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <ul className="divide-y divide-line">
        {visibleOrders.map((order) => {
          const href = orderHistoryPath(order.documentNumber);
          const currency = order.lines[0]?.currency ?? "USD";
          return (
            <li key={order.id}>
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={href} className="font-semibold text-ink hover:text-accent">
                    {order.documentNumber}
                  </Link>
                  <p className="text-sm text-ink-muted">{formatOrderStatus(order.status)}</p>
                  {order.shipLine1 ? (
                    <p className="text-sm text-ink-muted">
                      Ship to {order.shipLine1}, {order.shipCity}
                    </p>
                  ) : null}
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
