"use client";

import { useMemo, useState } from "react";
import { formatMoneyMinorUnits } from "../../lib/format-money";
import { formatOrderStatus, orderSubtotalCents } from "../../lib/order-history";
import {
  findPrototypeOrder,
  PROTOTYPE_ORDERS,
  type PrototypeOrder,
} from "../../lib/prototype/order-history-fixtures";
import { PrototypeOrderDetailBody } from "./prototype-order-detail-body";

export function OrderHistoryVariantC({
  initialDocumentNumber,
}: {
  initialDocumentNumber?: string;
}) {
  const initial = findPrototypeOrder(initialDocumentNumber ?? "") ?? PROTOTYPE_ORDERS[0];
  const [selectedNumber, setSelectedNumber] = useState(initial?.documentNumber ?? "");
  const [query, setQuery] = useState("");
  const selected = findPrototypeOrder(selectedNumber);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return PROTOTYPE_ORDERS;
    }
    return PROTOTYPE_ORDERS.filter((order) => {
      const haystack = [
        order.documentNumber,
        order.status,
        order.shipCity,
        ...order.lines.map((line) => line.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <label className="text-sm font-semibold text-ink" htmlFor="prototype-order-find">
          Find
        </label>
        <input
          id="prototype-order-find"
          className="shop-input w-52 shrink-0"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SO # or city"
        />
        <ul className="divide-y divide-line">
          {filtered.map((order) => (
            <li key={order.documentNumber}>
              <button
                type="button"
                onClick={() => setSelectedNumber(order.documentNumber)}
                className={
                  selectedNumber === order.documentNumber
                    ? "flex w-full flex-col items-start gap-1 bg-canvas-muted px-3 py-3 text-left"
                    : "flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-canvas"
                }
              >
                <span className="font-semibold text-ink">{order.documentNumber}</span>
                <span className="text-sm text-ink-muted">
                  {formatOrderStatus(order.status)} · {order.shipCity}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div>
        {selected === undefined ? (
          <p className="text-ink-muted">Select an order.</p>
        ) : (
          <SplitDetail order={selected} />
        )}
      </div>
    </div>
  );
}

function SplitDetail({ order }: { order: PrototypeOrder }) {
  const currency = order.lines[0]?.currency ?? "USD";
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Selected</p>
          <h2 className="page-title mt-2">{order.documentNumber}</h2>
          <p className="mt-2 text-sm text-ink-muted">Placed {order.placedOn}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-ink">{formatOrderStatus(order.status)}</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatMoneyMinorUnits(orderSubtotalCents(order.lines), currency)}
          </p>
        </div>
      </header>
      <PrototypeOrderDetailBody order={order} />
    </article>
  );
}
