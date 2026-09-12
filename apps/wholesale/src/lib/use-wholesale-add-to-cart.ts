"use client";

import {
  useApplyWholesaleSalesOrderLineDeltas,
  useCreateWholesaleSalesOrder,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cartLinesToDeltaBody } from "./cart-line-deltas";
import {
  cartQtyCapMessage,
  cartQtyOverCap,
  findDraftCartLine,
  linesForReplace,
  toReplaceLines,
} from "./cart-line-qty";
import { trackCartReplaceEnd, trackCartReplaceStart } from "./cart-mutation-gate";
import { wholesaleShortageErrorMessage } from "./confirm-shortage-message";
import { lookupWholesaleProductId } from "./lookup-wholesale-product-id";
import { shopDisplayAvailableQty, type ShopSellState } from "./shop-availability";
import { useActiveCart } from "./use-active-cart";
import {
  buildOptimisticDraftOrder,
  readDraftCartList,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type OptimisticLineMeta,
} from "./wholesale-cart-cache";

export type ApplyCartQtyResult =
  | { ok: true; kind: "added" | "updated" | "removed" | "same" }
  | { ok: false; message: string };

export type UseWholesaleAddToCartInput = {
  productId: string;
  name: string;
  unitPriceCents?: number;
  currency?: string;
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
};

export function useWholesaleAddToCart({
  productId,
  name,
  unitPriceCents = 0,
  currency = "USD",
  available,
  availableToSell,
  sellState,
}: UseWholesaleAddToCartInput) {
  const queryClient = useQueryClient();
  const { activeDraft, setActiveCart } = useActiveCart();
  const createOrder = useCreateWholesaleSalesOrder();
  const applyLineDeltas = useApplyWholesaleSalesOrderLineDeltas();
  const [pending, setPending] = useState(false);

  const draft = activeDraft;
  const cartLine =
    draft === undefined ? undefined : findDraftCartLine(draft.lines, productId, name);
  const inCart = cartLine !== undefined;
  const cartQty = cartLine?.qty ?? null;
  const maxQty = shopDisplayAvailableQty({ available, availableToSell, sellState });

  function lineMeta(): OptimisticLineMeta {
    return { name, unitPriceCents, currency, sku: cartLine?.sku };
  }

  async function applyQty(qty: number): Promise<ApplyCartQtyResult> {
    if (qty < 0 || !Number.isInteger(qty)) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
    }
    if (qty === 0 && !inCart) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
    }
    if (qty > 0 && maxQty !== null && cartQtyOverCap(qty, maxQty)) {
      return { ok: false, message: cartQtyCapMessage(maxQty) };
    }

    if (draft !== undefined) {
      if (inCart && qty === cartQty) {
        return { ok: true, kind: "same" };
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
      const targetLines =
        linesForReplace(nextLines) ??
        (await toReplaceLines(nextLines, lookupWholesaleProductId));
      if (targetLines === null) {
        return { ok: false, message: "Could not update cart" };
      }
      const deltaBody = cartLinesToDeltaBody(draft.lines, targetLines);

      const previous = readDraftCartList(queryClient);
      writeDraftCartOrder(
        queryClient,
        buildOptimisticDraftOrder(draft, targetLines, new Map([[productId, lineMeta()]])),
      );
      setPending(true);
      trackCartReplaceStart(draft.id);
      try {
        const response = await applyLineDeltas.mutateAsync({
          id: draft.id,
          data: deltaBody,
        });
        if (response.status === 200) {
          writeDraftCartOrder(queryClient, response.data);
        }
        return {
          ok: true,
          kind: qty === 0 ? "removed" : inCart ? "updated" : "added",
        };
      } catch (error: unknown) {
        if (previous !== undefined) {
          queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
        }
        return {
          ok: false,
          message: wholesaleShortageErrorMessage(error, "Could not update cart"),
        };
      } finally {
        trackCartReplaceEnd(draft.id);
        setPending(false);
      }
    }

    if (qty === 0) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
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
      return { ok: true, kind: "added" };
    } catch (error) {
      return {
        ok: false,
        message: wholesaleShortageErrorMessage(error, "Could not add to cart"),
      };
    } finally {
      setPending(false);
    }
  }

  return { applyQty, pending, inCart, cartQty, maxQty };
}
