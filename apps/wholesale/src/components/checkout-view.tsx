"use client";

import {
  useConfirmWholesaleSalesOrder,
  useListWholesaleSalesOrders,
  useListWholesaleShipTos,
} from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { wholesaleConfirmErrorMessage } from "../lib/confirm-shortage-message";
import {
  CHECKOUT_ACCOUNT_PATH,
  CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA,
  CHECKOUT_EMPTY_SHIP_TOS_MESSAGE,
} from "../lib/checkout-empty-copy";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { wholesaleDraftCartParams } from "../lib/wholesale-draft-cart";

function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

export function CheckoutView() {
  const router = useRouter();
  const [selectedShipToId, setSelectedShipToId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cart = useListWholesaleSalesOrders(wholesaleDraftCartParams);
  const shipTos = useListWholesaleShipTos();
  const confirmOrder = useConfirmWholesaleSalesOrder();

  const cartPayload = cart.data?.data;
  const shipToPayload = shipTos.data?.data;

  const draft =
    cartPayload && "items" in cartPayload ? cartPayload.items[0] : undefined;
  const shipToItems =
    shipToPayload && "items" in shipToPayload ? shipToPayload.items : [];

  const subtotalCents = useMemo(() => {
    if (draft === undefined) {
      return 0;
    }
    return draft.lines.reduce(
      (sum, line) => sum + lineSubtotalCents(line.qty, line.unitPriceCents),
      0,
    );
  }, [draft]);

  const currency = draft?.lines[0]?.currency ?? "USD";
  const canConfirm =
    draft !== undefined &&
    draft.lines.length > 0 &&
    selectedShipToId.length > 0 &&
    !confirmOrder.isPending;

  if (cart.isPending || shipTos.isPending) {
    return <p className="text-ink-muted">Loading checkout…</p>;
  }

  if (cart.isError || shipTos.isError || draft === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">No draft order to confirm.</p>
        <Link
          href="/cart"
          className="inline-flex w-fit rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Back To Cart
        </Link>
      </div>
    );
  }

  if (draft.lines.length === 0) {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {draft.lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
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

      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-semibold text-ink">Ship To</p>
        {shipToItems.length === 0 ? (
          <p className="mt-3 text-sm text-sold-out" role="alert">
            {CHECKOUT_EMPTY_SHIP_TOS_MESSAGE}{" "}
            <Link
              href={CHECKOUT_ACCOUNT_PATH}
              className="font-semibold text-accent hover:opacity-90"
            >
              {CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {shipToItems.map((shipTo) => (
              <li key={shipTo.id}>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-line px-4 py-3 hover:bg-canvas">
                  <input
                    type="radio"
                    name="shipTo"
                    value={shipTo.id}
                    checked={selectedShipToId === shipTo.id}
                    onChange={() => setSelectedShipToId(shipTo.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-ink">
                    <span className="font-semibold">{shipTo.line1}</span>
                    {shipTo.line2 ? `, ${shipTo.line2}` : ""}
                    <br />
                    {shipTo.city}, {shipTo.region} {shipTo.postal}
                    <br />
                    {shipTo.country}
                    {shipTo.isDefault ? (
                      <span className="ml-2 text-ink-muted">(Default)</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-sm text-ink-muted">Draft {draft.documentNumber}</p>
        <p className="text-lg font-semibold text-ink">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>

      {errorMessage !== null ? (
        <p className="text-sm text-sold-out" role="alert">{errorMessage}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/cart"
          className="inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Back To Cart
        </Link>
        <button
          type="button"
          disabled={!canConfirm}
          className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setErrorMessage(null);
            confirmOrder.mutate(
              {
                id: draft.id,
                data: {
                  idempotencyKey: `checkout-${draft.id}`,
                  shipToId: selectedShipToId,
                },
              },
              {
                onSuccess: () => {
                  router.push("/orders");
                },
                onError: (error) => {
                  setErrorMessage(wholesaleConfirmErrorMessage(error));
                },
              },
            );
          }}
        >
          {confirmOrder.isPending ? "Confirming…" : "Confirm Order"}
        </button>
      </div>
    </div>
  );
}
