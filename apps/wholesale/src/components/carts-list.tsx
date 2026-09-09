"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cartCurrency,
  cartDisplayName,
  cartLineCount,
  cartSubtotalCents,
  cartUnitCount,
} from "../lib/active-cart";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { flushCartPendingChanges, useCartMutationGate } from "../lib/cart-mutation-gate";
import { useActiveCart } from "../lib/use-active-cart";
import type { WholesaleDraftCartOrder } from "../lib/wholesale-cart-cache";

function CartDraftCard({
  draft,
  isActive,
  onMakeActive,
  onCheckout,
}: {
  draft: WholesaleDraftCartOrder;
  isActive: boolean;
  onMakeActive: () => void;
  onCheckout: (draftId: string) => void;
}) {
  const mutation = useCartMutationGate(draft.id);
  const checkoutBlocked = mutation.pending || mutation.dirty;

  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border bg-card p-5 ${
        isActive ? "border-accent shadow-sm" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{cartDisplayName(draft)}</h2>
          <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-ink-muted">
            {draft.documentNumber}
          </p>
        </div>
        {isActive ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-on-accent">
            Active
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-ink-muted">Lines</dt>
          <dd className="font-semibold tabular-nums text-ink">{cartLineCount(draft)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Units</dt>
          <dd className="font-semibold tabular-nums text-ink">{cartUnitCount(draft)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {formatMoneyMinorUnits(cartSubtotalCents(draft), cartCurrency(draft))}
          </dd>
        </div>
      </dl>
      <ul className="line-clamp-2 text-sm text-ink-muted">
        {draft.lines.slice(0, 3).map((line) => (
          <li key={line.id} className="inline">
            {line.qty}× {line.name}
            {"; "}
          </li>
        ))}
        {draft.lines.length > 3 ? (
          <li className="inline">+{draft.lines.length - 3} more</li>
        ) : null}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          href={`/cart/${draft.id}`}
          className="shop-button-secondary inline-flex min-h-10 items-center px-4 text-sm"
        >
          Open
        </Link>
        {isActive ? null : (
          <button
            type="button"
            onClick={onMakeActive}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-accent hover:bg-canvas"
          >
            Make Active
          </button>
        )}
        <button
          type="button"
          disabled={checkoutBlocked}
          onClick={() => {
            onCheckout(draft.id);
          }}
          className="ml-auto inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkoutBlocked ? "Saving…" : "Checkout"}
        </button>
      </div>
    </li>
  );
}

/** /cart — every open draft for this customer, with the active one marked. */
export function CartsList() {
  const router = useRouter();
  const activeCart = useActiveCart();
  const { drafts, active, isPending, isError, setActiveCart, startNewCart } = activeCart;

  if (isPending) {
    return <p className="text-ink-muted">Loading carts…</p>;
  }
  if (isError) {
    return (
      <p className="text-sold-out" role="alert">
        Carts are unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  function beginNewCart() {
    startNewCart();
    router.push("/products");
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">
          No open carts. Add a product and a cart is created for you.
        </p>
        <Link
          href="/products"
          className="shop-button-secondary inline-flex w-fit items-center px-5 text-sm"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const activeId = active.kind === "draft" ? active.draft.id : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {drafts.length} open {drafts.length === 1 ? "cart" : "carts"}.{" "}
          {active.kind === "new"
            ? "Your next Add to Cart starts a new one."
            : "Add to Cart goes to the active cart."}
        </p>
        <button
          type="button"
          onClick={beginNewCart}
          className="shop-button-primary inline-flex cursor-pointer items-center text-sm"
        >
          + Start New Cart
        </button>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {drafts.map((draft) => (
          <CartDraftCard
            key={draft.id}
            draft={draft}
            isActive={draft.id === activeId}
            onMakeActive={() => setActiveCart(draft.id)}
            onCheckout={(draftId) => {
              void flushCartPendingChanges(draftId).then((ok) => {
                if (ok) {
                  router.push(`/checkout?cart=${draftId}`);
                }
              });
            }}
          />
        ))}
      </ul>
    </div>
  );
}
