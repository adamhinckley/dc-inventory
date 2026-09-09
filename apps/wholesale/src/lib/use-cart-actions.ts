"use client";

import { useReplaceWholesaleSalesOrderLines } from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  acquireDraftMutationState,
  flushCartPendingChanges,
  setCartQtyDirty,
  trackCartReplaceEnd,
  trackCartReplaceStart,
  useCartMutationGate,
} from "./cart-mutation-gate";
import {
  linesForReplace,
  remainingDraftLines,
  toReplaceLines,
  type DraftCartLine,
} from "./cart-line-qty";
import { wholesaleShortageErrorMessage } from "./confirm-shortage-message";
import { lookupWholesaleProductId } from "./lookup-wholesale-product-id";
import {
  buildOptimisticDraftOrder,
  readDraftCartList,
  readDraftCartOrder,
  removeDraftCartOrder,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type WholesaleDraftCartOrder,
} from "./wholesale-cart-cache";

type ReplacePayload = Array<{ productId: string; qty: number }>;

export type CartActions = {
  pending: boolean;
  /** Debounced qty edits not yet PATCHed to the server. */
  dirty: boolean;
  message: string | null;
  setMessage: (message: string | null) => void;
  /** Flush debounced qty edits and wait for any in-flight PATCH before checkout. */
  flushPendingChanges: () => Promise<boolean>;
  setLineQty: (lineId: string, qty: number) => Promise<boolean>;
  /** Stepper: increment from the latest cached qty and debounce the PATCH. */
  adjustLineQty: (lineId: string, delta: number) => Promise<boolean>;
  removeLine: (lineId: string) => Promise<boolean>;
  rename: (label: string | null) => Promise<boolean>;
  /** Empty replace cancels the draft — the server-side "delete cart". */
  deleteCart: () => Promise<boolean>;
};

/**
 * Every cart surface (drawer, /cart/[id]) mutates a draft the same way:
 * optimistic cache write, one PATCH, roll back on failure. Sibling carts untouched.
 * Debounce and persist gates are shared per draft id so drawer and cart page agree.
 */
export function useCartActions(draft: WholesaleDraftCartOrder | undefined): CartActions {
  const queryClient = useQueryClient();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const [message, setMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const mutationGate = useCartMutationGate(draft?.id);
  const draftId = draft?.id;
  const mutationState = draftId === undefined ? undefined : acquireDraftMutationState(draftId);
  const persistQtyRef = useRef<(lines: ReplacePayload) => Promise<boolean>>(async () => true);

  async function persist(
    lines: ReplacePayload | null,
    failMessage: string,
    label?: string | null,
  ): Promise<boolean> {
    if (mutationState === undefined || draftId === undefined) {
      return false;
    }
    mutationState.queuedPersist = { lines, failMessage, label };
    const run = mutationState.persistGate.then(async () => {
      const next = mutationState.queuedPersist;
      mutationState.queuedPersist = null;
      if (next === null) {
        return true;
      }
      return persistNow(next.lines, next.failMessage, next.label);
    });
    mutationState.persistGate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function persistNow(
    lines: ReplacePayload | null,
    failMessage: string,
    label?: string | null,
  ): Promise<boolean> {
    const currentDraft = draftRef.current;
    if (currentDraft === undefined || draftId === undefined || mutationState === undefined) {
      return false;
    }
    if (lines === null) {
      setMessage(failMessage);
      return false;
    }
    setMessage(null);
    const previous = mutationState.burstPrevious ?? readDraftCartList(queryClient);
    mutationState.burstPrevious = undefined;
    if (lines.length === 0) {
      removeDraftCartOrder(queryClient, currentDraft.id);
    } else {
      const optimistic = buildOptimisticDraftOrder(currentDraft, lines);
      writeDraftCartOrder(
        queryClient,
        label === undefined
          ? optimistic
          : label === null
            ? { ...optimistic, label: undefined }
            : { ...optimistic, label },
      );
    }
    trackCartReplaceStart(draftId);
    try {
      const response = await replaceLines.mutateAsync({
        id: currentDraft.id,
        data: label === undefined ? { lines } : { lines, label },
      });
      if (response.status === 200) {
        writeDraftCartOrder(queryClient, response.data);
      }
      return true;
    } catch (error) {
      mutationState.qtyTask.cancel();
      if (previous !== undefined) {
        queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
      }
      setMessage(wholesaleShortageErrorMessage(error, failMessage));
      return false;
    } finally {
      trackCartReplaceEnd(draftId);
    }
  }

  persistQtyRef.current = async (lines) => persist(lines, "Could not update item");
  if (mutationState !== undefined) {
    mutationState.persistQtyHandler = async (lines) => persistQtyRef.current(lines);
  }

  async function toPayload(lines: readonly DraftCartLine[]): Promise<ReplacePayload | null> {
    return linesForReplace(lines) ?? (await toReplaceLines(lines, lookupWholesaleProductId));
  }

  function latestDraft(): WholesaleDraftCartOrder | undefined {
    const current = draftRef.current;
    if (current === undefined) {
      return undefined;
    }
    return readDraftCartOrder(queryClient, current.id) ?? current;
  }

  function writeOptimisticQty(lines: ReplacePayload): void {
    const currentDraft = draftRef.current;
    if (currentDraft === undefined || mutationState === undefined) {
      return;
    }
    if (mutationState.burstPrevious === undefined) {
      mutationState.burstPrevious = readDraftCartList(queryClient);
    }
    writeDraftCartOrder(queryClient, buildOptimisticDraftOrder(currentDraft, lines));
  }

  return {
    pending: mutationGate.pending,
    dirty: mutationGate.dirty,
    message,
    setMessage,
    async flushPendingChanges() {
      if (draftId === undefined) {
        return false;
      }
      return flushCartPendingChanges(draftId);
    },
    async setLineQty(lineId, qty) {
      if (mutationState === undefined) {
        return false;
      }
      await mutationState.qtyTask.flush();
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      if (qty <= 0) {
        return persist(
          await toPayload(remainingDraftLines(current.lines, lineId)),
          "Could not remove item",
        );
      }
      const next = current.lines.map((line) => (line.id === lineId ? { ...line, qty } : line));
      return persist(await toPayload(next), "Could not update item");
    },
    async adjustLineQty(lineId, delta) {
      if (mutationState === undefined || draftId === undefined) {
        return false;
      }
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      const line = current.lines.find((item) => item.id === lineId);
      if (line === undefined) {
        return false;
      }
      const qty = line.qty + delta;
      if (qty <= 0) {
        mutationState.qtyTask.cancel();
        setCartQtyDirty(draftId, false);
        return persist(
          await toPayload(remainingDraftLines(current.lines, lineId)),
          "Could not remove item",
        );
      }
      const next = current.lines.map((item) => (item.id === lineId ? { ...item, qty } : line));
      const payload = await toPayload(next);
      if (payload === null) {
        setMessage("Could not update item");
        return false;
      }
      writeOptimisticQty(payload);
      mutationState.qtyTask.schedule(payload);
      setCartQtyDirty(draftId, true);
      return true;
    },
    async removeLine(lineId) {
      if (mutationState === undefined || draftId === undefined) {
        return false;
      }
      mutationState.qtyTask.cancel();
      setCartQtyDirty(draftId, false);
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      const payload = await toPayload(remainingDraftLines(current.lines, lineId));
      if (payload !== null) {
        writeOptimisticQty(payload);
      }
      return persist(payload, "Could not remove item");
    },
    async rename(label) {
      if (mutationState === undefined) {
        return false;
      }
      await mutationState.qtyTask.flush();
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      return persist(await toPayload(current.lines), "Could not rename cart", label);
    },
    async deleteCart() {
      if (mutationState === undefined) {
        return false;
      }
      mutationState.qtyTask.cancel();
      return persist([], "Could not delete cart");
    },
  };
}
