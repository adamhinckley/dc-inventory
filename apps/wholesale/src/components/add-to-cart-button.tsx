"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cartQtyCapMessage,
  cartQtyOverCap,
  parseCartQty,
} from "../lib/cart-line-qty";
import { type ShopSellState } from "../lib/shop-availability";
import { useWholesaleAddToCart } from "../lib/use-wholesale-add-to-cart";

export type AddToCartButtonProps = {
  productId: string;
  name: string;
  unitPriceCents?: number;
  currency?: string;
  disabled?: boolean;
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
};

function CartRecordedIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-accent`} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.2 6l.4 2h12.7a1 1 0 0 1 .98 1.2l-1.2 6A2 2 0 0 1 17.12 17H8.3a2 2 0 0 1-1.96-1.6L4.1 5H2V3h2.7a1 1 0 0 1 .98.8L6.2 6Z"
      />
    </svg>
  );
}

export function AddToCartButton({
  productId,
  name,
  unitPriceCents = 0,
  currency = "USD",
  disabled = false,
  available,
  availableToSell,
  sellState,
}: AddToCartButtonProps) {
  const searchParams = useSearchParams();
  const fromCategory = searchParams.get("category");
  const continueHref =
    fromCategory !== null && fromCategory.length > 0
      ? `/products?category=${encodeURIComponent(fromCategory)}`
      : "/products";
  const { applyQty, pending, inCart, cartQty, maxQty } = useWholesaleAddToCart({
    productId,
    name,
    unitPriceCents,
    currency,
    available,
    availableToSell,
    sellState,
  });
  const qtyFieldId = `cart-qty-${productId}`;
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const inputDisabled = pending || (disabled && !inCart);
  useEffect(() => {
    if (qtyTouched) {
      return;
    }
    if (cartQty === null) {
      setQtyInput("1");
      return;
    }
    if (maxQty !== null && cartQtyOverCap(cartQty, maxQty)) {
      setQtyInput(String(maxQty));
      setMessage(cartQtyCapMessage(maxQty));
      return;
    }
    setQtyInput(String(cartQty));
  }, [cartQty, qtyTouched, maxQty]);

  function setQty(raw: string) {
    const parsed = parseCartQty(raw);
    if (parsed !== null && maxQty !== null && cartQtyOverCap(parsed, maxQty)) {
      setQtyInput(String(maxQty));
      setMessage(cartQtyCapMessage(maxQty));
      return;
    }
    setQtyTouched(true);
    setQtyInput(raw);
    setMessage(null);
  }

  function step(delta: number) {
    const current = parseCartQty(qtyInput) ?? 0;
    setQty(String(Math.max(inCart ? 0 : 1, current + delta)));
  }

  async function addToCart() {
    const qty = parseCartQty(qtyInput);
    if (qty === null || (qty === 0 && !inCart)) {
      setMessage("Enter a quantity of 1 or more");
      return;
    }
    const result = await applyQty(qty);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setQtyTouched(false);
    if (result.kind === "same") {
      setMessage("In cart");
      return;
    }
    setMessage(
      result.kind === "removed"
        ? "Removed from cart"
        : result.kind === "updated"
          ? "Updated cart"
          : "Added to cart",
    );
  }

  const buttonLabel = pending
    ? inCart
      ? "Updating…"
      : "Adding…"
    : inCart
      ? "Update Cart"
      : "Add to Cart";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={qtyFieldId} className="sr-only">
          Quantity
        </label>
        <div className="flex h-12 shrink-0 items-stretch overflow-hidden rounded-full border border-line bg-canvas">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={inputDisabled}
            onClick={() => step(-1)}
            className="w-11 text-lg text-ink-muted hover:text-ink disabled:opacity-40"
          >
            −
          </button>
          <span className="relative flex items-center">
            {inCart ? (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
                <span className="sr-only">In cart</span>
                <CartRecordedIcon />
              </span>
            ) : null}
            <input
              id={qtyFieldId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={maxQty === null ? 7 : String(maxQty).length}
              value={qtyInput}
              disabled={inputDisabled}
              onChange={(event) => setQty(event.target.value)}
              className={`w-[7ch] bg-transparent text-center tabular-nums text-ink focus:outline-none ${inCart ? "pl-5" : ""}`}
            />
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={inputDisabled}
            onClick={() => step(1)}
            className="w-11 text-lg text-ink-muted hover:text-ink disabled:opacity-40"
          >
            +
          </button>
        </div>
        <button
          type="button"
          disabled={inputDisabled || pending}
          onClick={() => {
            void addToCart();
          }}
          className="shop-button-primary inline-flex flex-1 items-center justify-center disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      </div>
      <p className="min-h-5 text-sm leading-5 text-ink-muted" role="status" aria-live="polite">
        {message ?? "\u00a0"}
      </p>
      <Link
        href={continueHref}
        className="shop-button-secondary inline-flex items-center justify-center text-sm"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
