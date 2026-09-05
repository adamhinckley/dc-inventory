"use client";

import { useListWholesaleSalesOrders } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";

function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

export function CartView() {
  const cart = useListWholesaleSalesOrders({
    status: "draft",
    page: 1,
    pageSize: 1,
    sortBy: "documentNumber",
    sortOrder: "desc",
  });

  if (cart.isPending) {
    return <p className="text-ink-muted">Loading cart…</p>;
  }

  const payload = cart.data?.data;
  if (cart.isError || !payload || !("items" in payload)) {
    return (
      <p className="text-sold-out" role="alert">
        Cart is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  const draft = payload.items[0];
  if (draft === undefined || draft.lines.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex w-fit rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const currency = draft.lines[0]?.currency ?? "USD";
  const subtotalCents = draft.lines.reduce(
    (sum, line) => sum + lineSubtotalCents(line.qty, line.unitPriceCents),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {draft.lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{line.name}</p>
                <p className="text-sm text-ink-muted">Qty {line.qty}</p>
              </div>
              <p className="text-base font-medium text-ink">
                {formatMoneyMinorUnits(
                  lineSubtotalCents(line.qty, line.unitPriceCents),
                  line.currency,
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-sm text-ink-muted">Draft {draft.documentNumber}</p>
        <p className="text-lg font-semibold text-ink">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Continue Shopping
        </Link>
        <Link
          href="/checkout"
          className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
