"use client";

import { useReplaceWholesaleSalesOrderLines } from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  linesForReplace,
  remainingDraftLines,
  toReplaceLines,
  type DraftCartLine,
} from "./cart-line-qty";
import { wholesaleShortageErrorMessage } from "./confirm-shortage-message";
import { createDebouncedTask } from "./debounce-task";
import { lookupWholesaleProductId } from "./lookup-wholesale-product-id";
import {
  buildOptimisticDraftOrder,
  readDraftCartList,
  readDraftCartOrder,
  removeDraftCartOrder,
  wholesaleDraftCartQueryKey,
  writeDraftCartOrder,
  type WholesaleDraftCartListResult,
  type WholesaleDraftCartOrder,
} from "./wholesale-cart-cache";

/** Quiet period before a +/- stepper PATCH. Latest qty wins. */
export const CART_QTY_DEBOUNCE_MS = 400;

type ReplacePayload = Array<{ productId: string; qty: number }>;

export type CartActions = {
  pending: boolean;
  message: string | null;
  setMessage: (message: string | null) => void;
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
 */
export function useCartActions(draft: WholesaleDraftCartOrder | undefined): CartActions {
  const queryClient = useQueryClient();
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const burstPreviousRef = useRef<WholesaleDraftCartListResult | undefined>(undefined);
  const persistQtyRef = useRef<(lines: ReplacePayload) => Promise<void>>(async () => undefined);
  const qtyTaskRef = useRef<ReturnType<typeof createDebouncedTask<ReplacePayload>> | undefined>(
    undefined,
  );
  const persistGate = useRef(Promise.resolve());
  const queuedPersist = useRef<{
    lines: ReplacePayload | null;
    failMessage: string;
    label?: string | null;
  } | null>(null);

  async function persist(
    lines: ReplacePayload | null,
    failMessage: string,
    label?: string | null,
  ): Promise<boolean> {
    queuedPersist.current = { lines, failMessage, label };
    const run = persistGate.current.then(async () => {
      const next = queuedPersist.current;
      queuedPersist.current = null;
      if (next === null) {
        return true;
      }
      return persistNow(next.lines, next.failMessage, next.label);
    });
    persistGate.current = run.then(
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
    if (currentDraft === undefined) {
      return false;
    }
    if (lines === null) {
      setMessage(failMessage);
      return false;
    }
    setSaving(true);
    setMessage(null);
    const previous = burstPreviousRef.current ?? readDraftCartList(queryClient);
    burstPreviousRef.current = undefined;
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
      qtyTaskRef.current?.cancel();
      if (previous !== undefined) {
        queryClient.setQueryData(wholesaleDraftCartQueryKey, previous);
      }
      setMessage(wholesaleShortageErrorMessage(error, failMessage));
      return false;
    } finally {
      setSaving(false);
    }
  }

  persistQtyRef.current = async (lines) => {
    await persist(lines, "Could not update item");
  };
  if (qtyTaskRef.current === undefined) {
    qtyTaskRef.current = createDebouncedTask(async (lines) => {
      await persistQtyRef.current(lines);
    }, CART_QTY_DEBOUNCE_MS);
  }

  useEffect(() => {
    const task = qtyTaskRef.current;
    return () => {
      void task?.flush();
    };
  }, []);

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
    if (currentDraft === undefined) {
      return;
    }
    if (burstPreviousRef.current === undefined) {
      burstPreviousRef.current = readDraftCartList(queryClient);
    }
    writeDraftCartOrder(queryClient, buildOptimisticDraftOrder(currentDraft, lines));
  }

  return {
    pending: saving || replaceLines.isPending,
    message,
    setMessage,
    async setLineQty(lineId, qty) {
      await qtyTaskRef.current?.flush();
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
        qtyTaskRef.current?.cancel();
        return persist(
          await toPayload(remainingDraftLines(current.lines, lineId)),
          "Could not remove item",
        );
      }
      const next = current.lines.map((item) => (item.id === lineId ? { ...item, qty } : item));
      const payload = await toPayload(next);
      if (payload === null) {
        setMessage("Could not update item");
        return false;
      }
      writeOptimisticQty(payload);
      qtyTaskRef.current?.schedule(payload);
      return true;
    },
    async removeLine(lineId) {
      qtyTaskRef.current?.cancel();
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
      await qtyTaskRef.current?.flush();
      const current = latestDraft();
      if (current === undefined) {
        return false;
      }
      return persist(await toPayload(current.lines), "Could not rename cart", label);
    },
    async deleteCart() {
      qtyTaskRef.current?.cancel();
      return persist([], "Could not delete cart");
    },
  };
}
