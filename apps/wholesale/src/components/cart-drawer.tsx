"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  cartCurrency,
  cartDisplayName,
  cartLineCount,
  cartSubtotalCents,
} from "../lib/active-cart";
import { closeCartDrawer, useCartDrawerOpen } from "../lib/cart-drawer-store";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { PRODUCT_PLACEHOLDER_SRC } from "../lib/product-image";
import { useActiveCart } from "../lib/use-active-cart";
import { useCartActions } from "../lib/use-cart-actions";
import { useWholesaleSignedIn } from "../lib/use-wholesale-signed-in";
import { CartSwitcher } from "./cart-switcher";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M6 6l12 12M18 6L6 18"
      />
    </svg>
  );
}

/**
 * Shopify-style slide-in cart. Always shows the *active* cart; the switcher at the
 * top moves between open carts or starts a new one. Opened from the header icon
 * and after every Add to Cart.
 */
export function CartDrawer() {
  const signedIn = useWholesaleSignedIn();
  const open = useCartDrawerOpen();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeCart = useActiveCart();
  const draft = activeCart.activeDraft;
  const actions = useCartActions(draft);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!signedIn) {
    return null;
  }

  const lines = draft?.lines ?? [];
  const subtotal = draft === undefined ? 0 : cartSubtotalCents(draft);
  const currency = draft === undefined ? "USD" : cartCurrency(draft);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Cart"
      className="shop-drawer"
      onClose={closeCartDrawer}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeCartDrawer();
        }
      }}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="section-title">Cart</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
              {draft === undefined
                ? activeCart.active.kind === "new"
                  ? "New cart"
                  : "Your cart"
                : cartDisplayName(draft)}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCartDrawer}
            aria-label="Close cart"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line text-ink hover:bg-canvas"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="border-b border-line px-5 py-3">
          <CartSwitcher activeCart={activeCart} id="cart-drawer-switcher" />
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {activeCart.isPending ? (
            <p className="py-8 text-ink-muted">Loading cart…</p>
          ) : draft === undefined || lines.length === 0 ? (
            <div className="flex flex-col items-start gap-4 py-10">
              <p className="text-ink-muted">
                {activeCart.active.kind === "new"
                  ? "Add a product and this becomes a new cart."
                  : "Your cart is empty."}
              </p>
              <Link
                href="/products"
                onClick={closeCartDrawer}
                className="shop-button-secondary inline-flex items-center px-5 text-sm"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-4 py-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={PRODUCT_PLACEHOLDER_SRC}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      {line.sku}
                    </p>
                    {line.productId !== undefined ? (
                      <Link
                        href={`/products/${line.productId}`}
                        onClick={closeCartDrawer}
                        className="line-clamp-2 text-sm font-semibold leading-snug text-ink hover:text-accent"
                      >
                        {line.name}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                        {line.name}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex h-8 items-stretch overflow-hidden rounded-full border border-line bg-canvas">
                        <button
                          type="button"
                          aria-label={`Decrease ${line.name}`}
                          onClick={() => {
                            void actions.adjustLineQty(line.id, -1);
                          }}
                          className="w-8 text-ink-muted hover:text-ink"
                        >
                          −
                        </button>
                        <span className="flex w-8 items-center justify-center text-sm tabular-nums text-ink">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${line.name}`}
                          onClick={() => {
                            void actions.adjustLineQty(line.id, 1);
                          }}
                          className="w-8 text-ink-muted hover:text-ink"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-ink">
                        {formatMoneyMinorUnits(line.qty * line.unitPriceCents, line.currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void actions.removeLine(line.id);
                      }}
                      className="mt-1 cursor-pointer text-xs font-semibold text-ink-muted underline-offset-2 hover:text-sold-out hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-line px-5 py-4">
          <p className="min-h-5 text-sm leading-5 text-ink-muted" role="status" aria-live="polite">
            {actions.message ?? "\u00a0"}
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-sm text-ink-muted">
              Subtotal · {draft === undefined ? 0 : cartLineCount(draft)}{" "}
              {draft !== undefined && cartLineCount(draft) === 1 ? "item" : "items"}
            </p>
            <p className="text-xl font-semibold tabular-nums text-ink">
              {formatMoneyMinorUnits(subtotal, currency)}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href={draft === undefined ? "/cart" : `/cart/${draft.id}`}
              onClick={closeCartDrawer}
              className="shop-button-secondary inline-flex items-center justify-center text-sm"
            >
              {draft === undefined ? "All Carts" : "View Cart"}
            </Link>
            <Link
              href={draft === undefined ? "/products" : `/checkout?cart=${draft.id}`}
              onClick={closeCartDrawer}
              aria-disabled={draft === undefined || lines.length === 0}
              className={`shop-button-primary inline-flex items-center justify-center text-sm ${
                draft === undefined || lines.length === 0 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Checkout
            </Link>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
