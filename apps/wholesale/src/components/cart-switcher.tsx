"use client";

import { cartDisplayName, cartLineCount, NEW_CART } from "../lib/active-cart";
import type { UseActiveCartResult } from "../lib/use-active-cart";

/**
 * "Which cart am I adding to?" — one select shared by the drawer and the cart pages.
 * Every open draft is listed; the last option starts a fresh one on the next add.
 */
export function CartSwitcher({
  activeCart,
  id = "cart-switcher",
  className = "",
}: {
  activeCart: UseActiveCartResult;
  id?: string;
  className?: string;
}) {
  const { drafts, active, setActiveCart, startNewCart } = activeCart;
  const value =
    active.kind === "draft" ? active.draft.id : active.kind === "new" ? NEW_CART : "";

  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        Adding to
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === NEW_CART) {
            startNewCart();
          } else if (next.length > 0) {
            setActiveCart(next);
          }
        }}
        className="shop-input min-h-10 cursor-pointer py-0 text-sm font-semibold"
      >
        {drafts.length === 0 ? (
          <option value="">No open carts yet</option>
        ) : null}
        {drafts.map((draft) => (
          <option key={draft.id} value={draft.id}>
            {cartDisplayName(draft)} · {cartLineCount(draft)}{" "}
            {cartLineCount(draft) === 1 ? "item" : "items"}
          </option>
        ))}
        <option value={NEW_CART}>+ Start a new cart</option>
      </select>
    </label>
  );
}
