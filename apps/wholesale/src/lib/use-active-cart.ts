"use client";

import {
  getGetWholesaleSessionQueryKey,
  useGetWholesaleSession,
  useListWholesaleSalesOrders,
} from "@dc-inventory/api-client-wholesale";
import { useCallback } from "react";
import { NEW_CART, resolveActiveCart, type ActiveCartResolution } from "./active-cart";
import { setStoredActiveCart, useStoredActiveCart } from "./active-cart-store";
import {
  wholesaleDraftCartQueryKey,
  type WholesaleDraftCartOrder,
} from "./wholesale-cart-cache";
import { wholesaleDraftCartParams } from "./wholesale-draft-cart";

export type UseActiveCartResult = {
  customerId: string | null;
  drafts: readonly WholesaleDraftCartOrder[];
  active: ActiveCartResolution<WholesaleDraftCartOrder>;
  /** The draft "Add to Cart" will PATCH, or undefined when the next add opens a new one. */
  activeDraft: WholesaleDraftCartOrder | undefined;
  isPending: boolean;
  isError: boolean;
  setActiveCart: (id: string) => void;
  startNewCart: () => void;
  clearActiveCart: () => void;
};

export function useActiveCart(): UseActiveCartResult {
  const session = useGetWholesaleSession({
    query: { queryKey: getGetWholesaleSessionQueryKey(), retry: false },
  });
  const customerId =
    session.data?.status === 200 ? session.data.data.customerId : null;
  const carts = useListWholesaleSalesOrders(wholesaleDraftCartParams, {
    query: { queryKey: wholesaleDraftCartQueryKey, enabled: customerId !== null },
  });
  const stored = useStoredActiveCart(customerId);

  const payload = carts.data?.data;
  const drafts: readonly WholesaleDraftCartOrder[] =
    payload !== undefined && "items" in payload ? payload.items : [];
  const active = resolveActiveCart(drafts, stored);

  const setActiveCart = useCallback(
    (id: string) => {
      if (customerId !== null) {
        setStoredActiveCart(customerId, id);
      }
    },
    [customerId],
  );
  const startNewCart = useCallback(() => {
    if (customerId !== null) {
      setStoredActiveCart(customerId, NEW_CART);
    }
  }, [customerId]);
  const clearActiveCart = useCallback(() => {
    if (customerId !== null) {
      setStoredActiveCart(customerId, null);
    }
  }, [customerId]);

  return {
    customerId,
    drafts,
    active,
    activeDraft: active.kind === "draft" ? active.draft : undefined,
    isPending: session.isPending || (customerId !== null && carts.isPending),
    isError: carts.isError,
    setActiveCart,
    startNewCart,
    clearActiveCart,
  };
}
