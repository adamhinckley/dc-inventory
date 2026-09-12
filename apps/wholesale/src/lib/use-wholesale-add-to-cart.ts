"use client";

import {
  useApplyWholesaleSalesOrderLineDeltas,
  useCreateWholesaleSalesOrder,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runExclusiveDraftCreate } from "./cart-create-gate";
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
  readActiveDraftCart,
  readDraftCartList,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type OptimisticLineMeta,
  type WholesaleDraftCartOrder,
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
  const { activeDraft, customerId, setActiveCart, isPending: activeCartPending } =
    useActiveCart();
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

  function resolveDraft(): WholesaleDraftCartOrder | undefined {
    if (draft !== undefined) {
      return draft;
    }
    if (customerId === null) {
      return undefined;
    }
    return readActiveDraftCart(queryClient, customerId);
  }

  async function patchDraft(
    currentDraft: WholesaleDraftCartOrder,
    qty: number,
  ): Promise<ApplyCartQtyResult> {
    const currentLine = findDraftCartLine(currentDraft.lines, productId, name);
    const currentInCart = currentLine !== undefined;
    const currentQty = currentLine?.qty ?? null;

    if (currentInCart && qty === currentQty) {
      return { ok: true, kind: "same" };
    }

    const others = currentDraft.lines.filter((line) => line !== currentLine);
    const nextLines =
      qty === 0
        ? others
        : [
            ...others,
            {
              productId,
              sku: currentLine?.sku ?? "",
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
    const deltaBody = cartLinesToDeltaBody(currentDraft.lines, targetLines);

    const previous = readDraftCartList(queryClient);
    writeDraftCartOrder(
      queryClient,
      buildOptimisticDraftOrder(
        currentDraft,
        targetLines,
        new Map([[productId, lineMeta()]]),
      ),
    );
    setPending(true);
    trackCartReplaceStart(currentDraft.id);
    try {
      const response = await applyLineDeltas.mutateAsync({
        id: currentDraft.id,
        data: deltaBody,
      });
      if (response.status === 200) {
        writeDraftCartOrder(queryClient, response.data);
      }
      return {
        ok: true,
        kind: qty === 0 ? "removed" : currentInCart ? "updated" : "added",
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
      trackCartReplaceEnd(currentDraft.id);
      setPending(false);
    }
  }

  async function applyQty(qty: number): Promise<ApplyCartQtyResult> {
    if (activeCartPending) {
      return { ok: false, message: "Loading cart…" };
    }
    if (qty < 0 || !Number.isInteger(qty)) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
    }
    if (qty === 0 && !inCart) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
    }
    if (qty > 0 && maxQty !== null && cartQtyOverCap(qty, maxQty)) {
      return { ok: false, message: cartQtyCapMessage(maxQty) };
    }

    const currentDraft = resolveDraft();
    if (currentDraft !== undefined) {
      return patchDraft(currentDraft, qty);
    }

    if (qty === 0) {
      return { ok: false, message: "Enter a quantity of 1 or more" };
    }

    setPending(true);
    try {
      const created = await runExclusiveDraftCreate(async () => {
        if (customerId !== null) {
          const existing = readActiveDraftCart(queryClient, customerId);
          if (existing !== undefined) {
            return existing;
          }
        }
        const response = await createOrder.mutateAsync({
          data: { lines: [{ productId, qty }] },
        });
        if (response.status === 201) {
          writeDraftCartOrder(queryClient, response.data);
          setActiveCart(response.data.id);
          return response.data;
        }
        return null;
      });

      if (created === null) {
        return { ok: false, message: "Could not add to cart" };
      }

      const createdLine = findDraftCartLine(created.lines, productId, name);
      if (createdLine !== undefined && createdLine.qty === qty) {
        return { ok: true, kind: "added" };
      }

      return patchDraft(created, qty);
    } catch (error) {
      return {
        ok: false,
        message: wholesaleShortageErrorMessage(error, "Could not add to cart"),
      };
    } finally {
      setPending(false);
    }
  }

  return { applyQty, pending: pending || activeCartPending, inCart, cartQty, maxQty };
}
