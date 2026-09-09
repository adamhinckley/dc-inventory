"use client";

import {
  useCreateWholesaleSalesOrder,
  useReplaceWholesaleSalesOrderLines,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cartQtyCapMessage,
  cartQtyOverCap,
  findDraftCartLine,
  linesForReplace,
  parseCartQty,
  toReplaceLines,
} from "../lib/cart-line-qty";
import { wholesaleShortageErrorMessage } from "../lib/confirm-shortage-message";
import { lookupWholesaleProductId } from "../lib/lookup-wholesale-product-id";
import {
  shopDisplayAvailableQty,
  type ShopSellState,
} from "../lib/shop-availability";
import { useActiveCart } from "../lib/use-active-cart";
import {
  buildOptimisticDraftOrder,
  readDraftCartList,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type OptimisticLineMeta,
} from "../lib/wholesale-cart-cache";

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
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const fromCategory = searchParams.get("category");
  const continueHref =
    fromCategory !== null && fromCategory.length > 0
      ? `/products?category=${encodeURIComponent(fromCategory)}`
      : "/products";
  const { activeDraft, setActiveCart } = useActiveCart();
  const createOrder = useCreateWholesaleSalesOrder();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const qtyFieldId = `cart-qty-${productId}`;
  const maxQty = shopDisplayAvailableQty({ available, availableToSell, sellState });
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const draft = activeDraft;
  const cartLine =
    draft === undefined ? undefined : findDraftCartLine(draft.lines, productId, name);
  const inCart = cartLine !== undefined;
  const cartQty = cartLine?.qty ?? null;
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

  function lineMeta(): OptimisticLineMeta {
    return { name, unitPriceCents, currency, sku: cartLine?.sku };
  }

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
    if (qty > 0 && maxQty !== null && cartQtyOverCap(qty, maxQty)) {
      setMessage(cartQtyCapMessage(maxQty));
      return;
    }
    setMessage(null);

    if (draft !== undefined) {
      if (inCart && qty === cartQty) {
        setMessage("In cart");
        return;
      }
      const others = draft.lines.filter((line) => line !== cartLine);
      const nextLines =
        qty === 0
          ? others
          : [
              ...others,
              {
                productId,
                sku: cartLine?.sku ?? "",
                name,
                qty,
              },
            ];
      const lines =
        linesForReplace(nextLines) ??
        (await toReplaceLines(nextLines, lookupWholesaleProductId));
      if (lines === null) {
        setMessage("Could not update cart");
        return;
      }

      const previous = readDraftCartList(queryClient);
      writeDraftCartOrder(
        queryClient,
        buildOptimisticDraftOrder(draft, lines, new Map([[productId, lineMeta()]])),
      );
      setPending(true);
      try {
        const response = await replaceLines.mutateAsync({
          id: draft.id,
          data: { lines },
        });
        if (response.status === 200) {
          writeDraftCartOrder(queryClient, response.data);
        }
        setQtyTouched(false);
        setMessage(qty === 0 ? "Removed from cart" : inCart ? "Updated cart" : "Added to cart");
      } catch (error: unknown) {
        if (previous !== undefined) {
          queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
        }
        setMessage(wholesaleShortageErrorMessage(error, "Could not update cart"));
      } finally {
        setPending(false);
      }
      return;
    }

    setPending(true);
    try {
      const response = await createOrder.mutateAsync({
        data: { lines: [{ productId, qty }] },
      });
      if (response.status === 201) {
        writeDraftCartOrder(queryClient, response.data);
        setActiveCart(response.data.id);
      }
      setQtyTouched(false);
      setMessage("Added to cart");
    } catch (error) {
      setMessage(
        wholesaleShortageErrorMessage(error, "Could not add to cart"),
      );
    } finally {
      setPending(false);
    }
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
