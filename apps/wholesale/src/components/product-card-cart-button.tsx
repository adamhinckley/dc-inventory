"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cartQtyOverCap } from "../lib/cart-line-qty";
import { shopAvailabilityLabel, type ShopSellState } from "../lib/shop-availability";
import { useWholesaleAddToCart } from "../lib/use-wholesale-add-to-cart";
import { useWholesaleSession } from "../lib/use-wholesale-signed-in";

export type ProductCardCartButtonProps = {
  productId: string;
  name: string;
  unitPriceCents: number;
  currency: string;
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
};

function CartGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
}

function loginHref(category: string | null): string {
  if (category !== null && category.length > 0) {
    return `/login?category=${encodeURIComponent(category)}`;
  }
  return "/login";
}

export function ProductCardCartButton({
  productId,
  name,
  unitPriceCents,
  currency,
  available,
  availableToSell,
  sellState,
}: ProductCardCartButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const { signedIn } = useWholesaleSession();
  const { applyQty, pending, inCart, cartQty, maxQty } = useWholesaleAddToCart({
    productId,
    name,
    unitPriceCents,
    currency,
    available,
    availableToSell,
    sellState,
  });
  const [message, setMessage] = useState<string | null>(null);
  const { inStock } = shopAvailabilityLabel({ available, availableToSell, sellState });
  const nextQty = (cartQty ?? 0) + 1;
  const atCap = cartQtyOverCap(nextQty, maxQty);
  const blocked = !inStock || atCap;

  async function onClick() {
    if (blocked || pending) {
      return;
    }
    if (!signedIn) {
      router.push(loginHref(category));
      return;
    }
    const result = await applyQty(nextQty);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
  }

  const label = !inStock
    ? `${name} is unavailable`
    : atCap
      ? `${name} is already at the available quantity in the cart`
      : inCart
        ? `Add another ${name} to cart, ${cartQty} in cart`
        : `Add ${name} to cart`;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={blocked || pending}
        aria-busy={pending}
        onClick={() => {
          void onClick();
        }}
        className={`absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-overlay text-ink shadow-[0_1px_4px_rgb(31_27_22_/_0.45)] ring-2 ring-ink hover:bg-accent hover:text-on-accent hover:ring-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          blocked ? "pointer-events-none" : "cursor-pointer"
        }`}
      >
        <CartGlyph />
        {inCart && cartQty !== null && cartQty > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-4 text-on-accent ring-1 ring-overlay">
            {cartQty > 99 ? "99+" : cartQty}
          </span>
        ) : null}
      </button>
      <p
        className={`absolute bottom-2 left-2 right-12 z-10 text-[0.6875rem] leading-4 text-sold-out ${
          message === null ? "pointer-events-none" : "min-h-4"
        }`}
        role="status"
        aria-live="polite"
      >
        {message ?? ""}
      </p>
    </>
  );
}
