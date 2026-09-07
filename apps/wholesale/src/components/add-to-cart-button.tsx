"use client";

import {
  useCreateWholesaleSalesOrder,
  useListWholesaleSalesOrders,
  useReplaceWholesaleSalesOrderLines,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  buildOptimisticDraftOrder,
  readDraftCartList,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type OptimisticLineMeta,
} from "../lib/wholesale-cart-cache";
import { wholesaleDraftCartParams } from "../lib/wholesale-draft-cart";

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
  const cart = useListWholesaleSalesOrders(wholesaleDraftCartParams);
  const createOrder = useCreateWholesaleSalesOrder();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const qtyFieldId = `cart-qty-${productId}`;
  const maxQty = shopDisplayAvailableQty({ available, availableToSell, sellState });
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyTouched, setQtyTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const draft =
    cart.data?.data && "items" in cart.data.data ? cart.data.data.items[0] : undefined;
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
    setPending(true);

    try {
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
          buildOptimisticDraftOrder(
            draft,
            lines,
            new Map([[productId, lineMeta()]]),
          ),
        );

        try {
          const response = await replaceLines.mutateAsync({
            id: draft.id,
            data: { lines },
          });
          if (response.status === 200) {
            if (response.data.status === "cancelled" || response.data.lines.length === 0) {
              writeDraftCartOrder(queryClient, null);
            } else {
              writeDraftCartOrder(queryClient, response.data);
            }
          }
          setQtyTouched(false);
          setMessage(qty === 0 ? "Removed from cart" : "Updated cart");
        } catch (error) {
          if (previous !== undefined) {
            queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
          }
          setMessage(wholesaleShortageErrorMessage(error, "Could not update cart"));
        }
        return;
      }

      const response = await createOrder.mutateAsync({
        data: { lines: [{ productId, qty }] },
      });
      if (response.status === 201) {
        writeDraftCartOrder(queryClient, response.data);
      }
      setQtyTouched(false);
      setMessage("Added to cart");
    } catch (error) {
      setMessage(
        wholesaleShortageErrorMessage(
          error,
          draft === undefined ? "Could not add to cart" : "Could not update cart",
        ),
      );
    } finally {
      setPending(false);
    }
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
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={maxQty === null ? 7 : String(maxQty).length}
            value={qtyInput}
            disabled={inputDisabled}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = parseCartQty(raw);
              if (parsed !== null && maxQty !== null && cartQtyOverCap(parsed, maxQty)) {
                setQtyInput(String(maxQty));
                setMessage(cartQtyCapMessage(maxQty));
                return;
              }
              setQtyTouched(true);
              setQtyInput(raw);
              setMessage(null);
            }}
            className="shop-input min-h-0 w-[calc(7ch+4.25rem)] max-w-[calc(7ch+4.25rem)] shrink-0 py-2.5 pl-9 text-center tabular-nums"
          />
        </span>
        <button
          type="button"
          disabled={inputDisabled || pending}
          onClick={() => {
            void addToCart();
          }}
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
