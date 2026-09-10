"use client";

import {
  useApplyWholesaleSalesOrderLineDeltas,
  useReplaceWholesaleSalesOrderLines,
} from "@dc-inventory/api-client-wholesale";
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
  mapDraftLineQty,
  remainingDraftLines,
  toReplaceLines,
  type DraftCartLine,
} from "./cart-line-qty";
import {
  cartDeltaBaselineLines,
  cartLinesToDeltaBody,
  hasCartLineDeltaWork,
} from "./cart-line-deltas";
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
  /** Debounced qty edits not yet POSTed to line-jobs. */
  dirty: boolean;
  message: string | null;
  setMessage: (message: string | null) => void;
  /** Flush debounced qty edits and wait for any in-flight line-jobs before checkout. */
  flushPendingChanges: () => Promise<boolean>;
  setLineQty: (lineId: string, qty: number) => Promise<boolean>;
  /** Stepper: increment from the latest cached qty and debounce the line-jobs POST. */
  adjustLineQty: (lineId: string, delta: number) => Promise<boolean>;
  removeLine: (lineId: string) => Promise<boolean>;
  rename: (label: string | null) => Promise<boolean>;
  /** Empty replace cancels the draft — the server-side "delete cart". */
  deleteCart: () => Promise<boolean>;
};

/**
 * Every cart surface (drawer, /cart/[id]) mutates a draft the same way:
 * optimistic cache write, one line-jobs POST (or full PATCH for rename), roll back on failure.
 * Debounce and persist gates are shared per draft id so drawer and cart page agree.
 */
export function useCartActions(draft: WholesaleDraftCartOrder | undefined): CartActions {
  const queryClient = useQueryClient();
  const applyLineDeltas = useApplyWholesaleSalesOrderLineDeltas();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const [message, setMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const mutationGate = useCartMutationGate(draft?.id);
  const draftId = draft?.id;
  const mutationState = draftId === undefined ? undefined : acquireDraftMutationState(draftId);

  async function persist(
    targetDraftId: string,
    lines: ReplacePayload | null,
    failMessage: string,
    label?: string | null,
  ): Promise<boolean> {
    const state = acquireDraftMutationState(targetDraftId);
    state.queuedPersist = { lines, failMessage, label };
    const run = state.persistGate.then(async () => {
      const next = state.queuedPersist;
      state.queuedPersist = null;
      if (next === null) {
        return true;
      }
      return persistNow(targetDraftId, next.lines, next.failMessage, next.label);
    });
    state.persistGate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function persistNow(
    targetDraftId: string,
    lines: ReplacePayload | null,
    failMessage: string,
    label?: string | null,
  ): Promise<boolean> {
    const state = acquireDraftMutationState(targetDraftId);
    const currentDraft = readDraftCartOrder(queryClient, targetDraftId);
    if (currentDraft === undefined) {
      return false;
    }
    if (lines === null) {
      setMessage(failMessage);
      return false;
    }
    setMessage(null);
    const previous = state.burstPrevious ?? readDraftCartList(queryClient);
    const baselineLines = cartDeltaBaselineLines(targetDraftId, currentDraft.lines, previous);
    state.burstPrevious = undefined;
    if (lines.length === 0) {
      removeDraftCartOrder(queryClient, targetDraftId);
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
    trackCartReplaceStart(targetDraftId);
    try {
      const response =
        label === undefined
          ? await (async () => {
              const deltas = cartLinesToDeltaBody(baselineLines, lines);
              if (!hasCartLineDeltaWork(deltas)) {
                return { status: 200 as const, data: currentDraft };
              }
              return applyLineDeltas.mutateAsync({
                id: targetDraftId,
                data: deltas,
              });
            })()
          : await replaceLines.mutateAsync({
              id: targetDraftId,
              data: { lines, label },
            });
      if (response.status === 200) {
        writeDraftCartOrder(queryClient, response.data);
      }
      return true;
    } catch (error) {
      state.qtyTask.cancel();
      if (previous !== undefined) {
        queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
      }
      setMessage(wholesaleShortageErrorMessage(error, failMessage));
      return false;
    } finally {
      trackCartReplaceEnd(targetDraftId);
    }
  }

  if (mutationState !== undefined && draftId !== undefined) {
    const boundDraftId = draftId;
    mutationState.persistQtyHandler = async (lines) =>
      persist(boundDraftId, lines, "Could not update item");
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

  function writeOptimisticQty(targetDraftId: string, lines: ReplacePayload): void {
    const currentDraft = readDraftCartOrder(queryClient, targetDraftId);
    if (currentDraft === undefined) {
      return;
    }
    const state = acquireDraftMutationState(targetDraftId);
    if (state.burstPrevious === undefined) {
      state.burstPrevious = readDraftCartList(queryClient);
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
      if (mutationState === undefined || draftId === undefined) {
        return false;
      }
      await mutationState.qtyTask.flush();
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      if (qty <= 0) {
        return persist(
          draftId,
          await toPayload(remainingDraftLines(current.lines, lineId)),
          "Could not remove item",
        );
      }
      const next = mapDraftLineQty(current.lines, lineId, qty);
      return persist(draftId, await toPayload(next), "Could not update item");
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
          draftId,
          await toPayload(remainingDraftLines(current.lines, lineId)),
          "Could not remove item",
        );
      }
      const next = mapDraftLineQty(current.lines, lineId, qty);
      const payload = await toPayload(next);
      if (payload === null) {
        setMessage("Could not update item");
        return false;
      }
      writeOptimisticQty(draftId, payload);
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
        writeOptimisticQty(draftId, payload);
      }
      return persist(draftId, payload, "Could not remove item");
    },
    async rename(label) {
      if (mutationState === undefined || draftId === undefined) {
        return false;
      }
      await mutationState.qtyTask.flush();
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      return persist(draftId, await toPayload(current.lines), "Could not rename cart", label);
    },
    async deleteCart() {
      if (draftId === undefined || mutationState === undefined) {
        return false;
      }
      mutationState.qtyTask.cancel();
      return persist(draftId, [], "Could not delete cart");
    },
  };
}
