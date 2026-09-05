"use client";

import { useListWholesaleSalesOrders } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { useMemo } from "react";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { isVisibleOrderStatus } from "../lib/order-history";

const PAGE_SIZE = 50;

function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

function useHistoryOrders(status: "confirmed" | "shipped" | "cancelled") {
  return useListWholesaleSalesOrders({
    status,
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "documentNumber",
    sortOrder: "desc",
  });
}

export function OrdersHistoryView() {
  const confirmed = useHistoryOrders("confirmed");
  const shipped = useHistoryOrders("shipped");
  const cancelled = useHistoryOrders("cancelled");

  const isPending = confirmed.isPending || shipped.isPending || cancelled.isPending;
  const isError = confirmed.isError || shipped.isError || cancelled.isError;

  const visibleOrders = useMemo(() => {
    const items = [
      confirmed.data?.data,
      shipped.data?.data,
      cancelled.data?.data,
    ].flatMap((payload) => (payload && "items" in payload ? payload.items : []));
    return items
      .filter((order) => isVisibleOrderStatus(order.status))
      .sort((left, right) => right.documentNumber.localeCompare(left.documentNumber));
  }, [cancelled.data?.data, confirmed.data?.data, shipped.data?.data]);

  if (isPending) {
    return <p className="text-ink-muted">Loading orders…</p>;
  }

  if (isError) {
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
          const currency = order.lines[0]?.currency ?? "USD";
          const subtotalCents = order.lines.reduce(
            (sum, line) => sum + lineSubtotalCents(line.qty, line.unitPriceCents),
            0,
          );
          return (
            <li
              key={order.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-ink">{order.documentNumber}</p>
                <p className="text-sm capitalize text-ink-muted">{order.status}</p>
                {order.shipLine1 ? (
                  <p className="text-sm text-ink-muted">
                    Ship to {order.shipLine1}, {order.shipCity}
                  </p>
                ) : null}
              </div>
              <p className="text-base font-medium text-ink">
                {formatMoneyMinorUnits(subtotalCents, currency)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
