"use client";

import {
  getListWholesaleSalesOrdersQueryKey,
  useCreateWholesaleSalesOrder,
  useListWholesaleSalesOrders,
  useReplaceWholesaleSalesOrderLines,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { findDraftCartLine, parseCartQty, toReplaceLines } from "../lib/cart-line-qty";
import { lookupWholesaleProductId } from "../lib/lookup-wholesale-product-id";
import { wholesaleDraftCartParams } from "../lib/wholesale-draft-cart";

export type AddToCartButtonProps = {
  productId: string;
  name: string;
  disabled?: boolean;
};

function CartRecordedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 text-accent"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.2 6l.4 2h12.7a1 1 0 0 1 .98 1.2l-1.2 6A2 2 0 0 1 17.12 17H8.3a2 2 0 0 1-1.96-1.6L4.1 5H2V3h2.7a1 1 0 0 1 .98.8L6.2 6Z"
      />
    </svg>
  );
}

export function AddToCartButton({ productId, name, disabled = false }: AddToCartButtonProps) {
  const queryClient = useQueryClient();
  const cart = useListWholesaleSalesOrders(wholesaleDraftCartParams);
  const createOrder = useCreateWholesaleSalesOrder();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const qtyFieldId = `cart-qty-${productId}`;
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const draft =
    cart.data?.data && "items" in cart.data.data ? cart.data.data.items[0] : undefined;
  const cartLine =
    draft === undefined ? undefined : findDraftCartLine(draft.lines, productId, name);
  const inCart = cartLine !== undefined;
  const cartQty = cartLine?.qty ?? null;
  const pending = createOrder.isPending || replaceLines.isPending;
  const inputDisabled = pending || (disabled && !inCart);

  useEffect(() => {
    if (qtyTouched) {
      return;
    }
    setQtyInput(cartQty !== null ? String(cartQty) : "1");
  }, [cartQty, qtyTouched]);

  function invalidateCart() {
    return queryClient.invalidateQueries({
      queryKey: getListWholesaleSalesOrdersQueryKey(),
    });
  }

  async function addToCart() {
    const qty = parseCartQty(qtyInput);
    if (qty === null || (qty === 0 && !inCart)) {
      setMessage("Enter a quantity of 1 or more");
      return;
    }
    setMessage(null);

    if (inCart && draft !== undefined && cartLine !== undefined) {
      if (qty === cartQty) {
        setMessage("In cart");
        return;
      }
      const others = draft.lines.filter((line) => line !== cartLine);
      const nextLines =
        qty === 0
          ? others
          : [...others, { productId, sku: cartLine.sku, name, qty }];
      const lines = await toReplaceLines(nextLines, lookupWholesaleProductId);
      if (lines === null) {
        setMessage("Could not update cart");
        return;
      }
      replaceLines.mutate(
        { id: draft.id, data: { lines } },
        {
          onSuccess: async () => {
            await invalidateCart();
            setQtyTouched(false);
            setMessage(qty === 0 ? "Removed from cart" : "Updated cart");
          },
          onError: () => {
            setMessage("Could not update cart");
          },
        },
      );
      return;
    }

    createOrder.mutate(
      { data: { lines: [{ productId, qty }] } },
      {
        onSuccess: async () => {
          await invalidateCart();
          setQtyTouched(false);
          setMessage("Added to cart");
        },
        onError: () => {
          setMessage("Could not add to cart");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={qtyFieldId} className="sr-only">
          Quantity
        </label>
        <span className="relative shrink-0">
          {inCart ? (
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
              <span className="sr-only">In cart</span>
              <CartRecordedIcon />
            </span>
          ) : null}
          <input
            id={qtyFieldId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={qtyInput}
            disabled={inputDisabled}
            onChange={(event) => {
              setQtyTouched(true);
              setQtyInput(event.target.value);
            }}
            className="shop-input min-h-0 w-[calc(7ch+4.25rem)] max-w-[calc(7ch+4.25rem)] shrink-0 py-2.5 pl-9 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </span>
        <button
          type="button"
          disabled={inputDisabled || pending}
          onClick={addToCart}
          className="inline-flex min-h-0 flex-1 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? inCart
              ? "Updating…"
              : "Adding…"
            : inCart
              ? "Update Cart"
              : "Add to Cart"}
        </button>
      </div>
      <p
        className="min-h-5 text-sm leading-5 text-ink-muted"
        role="status"
        aria-live="polite"
      >
        {message ?? "\u00a0"}
      </p>
    </div>
  );
}
