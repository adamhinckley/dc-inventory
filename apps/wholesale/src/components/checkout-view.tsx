"use client";

import {
  useConfirmWholesaleSalesOrder,
  useGetWholesaleSession,
  useListWholesaleShipTos,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cartDisplayName } from "../lib/active-cart";
import { initialCheckoutShipToId } from "../lib/checkout-ship-to";
import { wholesaleConfirmErrorMessage } from "../lib/confirm-shortage-message";
import {
  CHECKOUT_ACCOUNT_PATH,
  CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA,
  CHECKOUT_EMPTY_SHIP_TOS_MESSAGE,
} from "../lib/checkout-empty-copy";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { flushCartPendingChanges, useCartMutationGate } from "../lib/cart-mutation-gate";
import { useActiveCart } from "../lib/use-active-cart";
import { removeDraftCartOrder } from "../lib/wholesale-cart-cache";

function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

/** `?cart=<id>` picks the draft to confirm; without it, the active cart. */
export function CheckoutView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedCartId = searchParams.get("cart");
  const [selectedShipToId, setSelectedShipToId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [creditOverrideOpen, setCreditOverrideOpen] = useState(false);

  const activeCart = useActiveCart();
  const session = useGetWholesaleSession();
  const shipTos = useListWholesaleShipTos();
  const confirmOrder = useConfirmWholesaleSalesOrder();
  const staffActing =
    session.data?.status === 200 && session.data.data.mode === "staff_acting";

  const shipToPayload = shipTos.data?.data;

  const draft =
    requestedCartId !== null
      ? activeCart.drafts.find((item) => item.id === requestedCartId)
      : activeCart.activeDraft;
  const cartMutation = useCartMutationGate(draft?.id);
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

  useEffect(() => {
    const initial = initialCheckoutShipToId(shipToItems);
    if (initial !== null) {
      setSelectedShipToId((current) => (current === "" ? initial : current));
    }
  }, [shipToItems]);

  const canConfirm =
    draft !== undefined &&
    draft.lines.length > 0 &&
    selectedShipToId.length > 0 &&
    !confirmOrder.isPending &&
    !confirming &&
    !cartMutation.pending &&
    !cartMutation.dirty;

  function submitConfirm(overrideCredit: boolean) {
    if (draft === undefined) {
      return;
    }
    setErrorMessage(null);
    const confirmedId = draft.id;
    const wasActive = activeCart.activeDraft?.id === confirmedId;
    setConfirming(true);
    void flushCartPendingChanges(confirmedId).then((ok) => {
      if (!ok) {
        setConfirming(false);
        setErrorMessage("Could not save cart changes. Try again.");
        return;
      }
      confirmOrder.mutate(
        {
          id: confirmedId,
          data: {
            idempotencyKey: `checkout-${confirmedId}`,
            shipToId: selectedShipToId,
            ...(overrideCredit ? { overrideCredit: true } : {}),
          },
        },
        {
          onSuccess: () => {
            setCreditOverrideOpen(false);
            removeDraftCartOrder(queryClient, confirmedId);
            if (wasActive) {
              activeCart.clearActiveCart();
            }
            router.push("/orders");
          },
          onError: (error) => {
            setConfirming(false);
            const creditExceeded =
              error instanceof Error &&
              "data" in error &&
              typeof error.data === "object" &&
              error.data !== null &&
              "error" in error.data &&
              error.data.error === "credit_exceeded";
            if (!overrideCredit && staffActing && creditExceeded) {
              setCreditOverrideOpen(true);
              return;
            }
            setErrorMessage(wholesaleConfirmErrorMessage(error));
          },
        },
      );
    });
  }

  if (activeCart.isPending || shipTos.isPending) {
    return <p className="text-ink-muted">Loading checkout…</p>;
  }

  if (activeCart.isError || shipTos.isError || draft === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">No draft order to confirm.</p>
        <Link
          href="/cart"
          className="inline-flex w-fit rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          All Carts
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
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{cartDisplayName(draft)}</span>
          {" · "}
          {draft.documentNumber}
        </p>
        <p className="text-lg font-semibold text-ink">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>

      {errorMessage !== null ? (
        <p className="text-sm text-sold-out" role="alert">{errorMessage}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/cart/${draft.id}`}
          className="inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Back To Cart
        </Link>
        <button
          type="button"
          disabled={!canConfirm}
          className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            void submitConfirm(false);
          }}
        >
          {confirming || cartMutation.pending || cartMutation.dirty
            ? "Saving…"
            : confirmOrder.isPending
              ? "Confirming…"
              : "Confirm Order"}
        </button>
      </div>

      {creditOverrideOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-override-title"
        >
          <div className="overlay w-full max-w-md rounded-2xl border border-sold-out p-6 shadow-overlay">
            <h2 id="credit-override-title" className="text-lg font-semibold text-ink">
              Credit Limit Exceeded
            </h2>
            <p className="mt-3 text-sm text-sold-out">
              This order exceeds the customer&apos;s available credit. Confirm only if
              you intend to place it anyway.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink"
                onClick={() => setCreditOverrideOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-sold-out px-4 py-2 text-sm font-semibold text-on-accent"
                disabled={confirmOrder.isPending || confirming}
                onClick={() => submitConfirm(true)}
              >
                {confirmOrder.isPending || confirming ? "Confirming…" : "Confirm Anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
