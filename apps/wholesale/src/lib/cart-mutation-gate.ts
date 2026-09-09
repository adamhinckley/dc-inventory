"use client";

import { useSyncExternalStore } from "react";
import { createDebouncedTask } from "./debounce-task";
import type { WholesaleDraftCartListResult } from "./wholesale-cart-cache";

/** Quiet period before a +/- stepper PATCH. Latest qty wins. */
export const CART_QTY_DEBOUNCE_MS = 400;

type ReplacePayload = Array<{ productId: string; qty: number }>;

export type CartMutationSnapshot = {
  pending: boolean;
  dirty: boolean;
};

type DraftMutationState = {
  qtyTask: ReturnType<typeof createDebouncedTask<ReplacePayload>>;
  persistGate: Promise<void>;
  queuedPersist: {
    lines: ReplacePayload | null;
    failMessage: string;
    label?: string | null;
  } | null;
  qtyDirty: boolean;
  inFlightCount: number;
  lastFlushOk: boolean;
  burstPrevious?: WholesaleDraftCartListResult;
  persistQtyHandler: (lines: ReplacePayload) => Promise<boolean>;
};

const gates = new Map<string, DraftMutationState>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readSnapshot(draftId: string | undefined): CartMutationSnapshot {
  if (draftId === undefined) {
    return { pending: false, dirty: false };
  }
  const state = gates.get(draftId);
  if (state === undefined) {
    return { pending: false, dirty: false };
  }
  return {
    pending: state.inFlightCount > 0,
    dirty: state.qtyDirty || state.qtyTask.hasPending(),
  };
}

function createDraftMutationState(draftId: string): DraftMutationState {
  const state: DraftMutationState = {
    qtyDirty: false,
    inFlightCount: 0,
    lastFlushOk: true,
    persistGate: Promise.resolve(),
    queuedPersist: null,
    persistQtyHandler: async () => true,
    qtyTask: createDebouncedTask(async (lines) => {
      const current = gates.get(draftId);
      if (current === undefined) {
        return;
      }
      try {
        current.lastFlushOk = await current.persistQtyHandler(lines);
      } finally {
        current.qtyDirty = false;
        emit();
      }
    }, CART_QTY_DEBOUNCE_MS),
  };
  return state;
}

/** One debounce + persist gate per draft, shared by drawer, cart page, and checkout. */
export function acquireDraftMutationState(draftId: string): DraftMutationState {
  const existing = gates.get(draftId);
  if (existing !== undefined) {
    return existing;
  }
  const state = createDraftMutationState(draftId);
  gates.set(draftId, state);
  return state;
}

export function readCartMutationSnapshot(draftId: string | undefined): CartMutationSnapshot {
  return readSnapshot(draftId);
}

export function useCartMutationGate(draftId: string | undefined): CartMutationSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => readSnapshot(draftId),
    () => ({ pending: false, dirty: false }),
  );
}

export function setCartQtyDirty(draftId: string, dirty: boolean): void {
  const state = acquireDraftMutationState(draftId);
  if (state.qtyDirty === dirty) {
    return;
  }
  state.qtyDirty = dirty;
  emit();
}

export function trackCartReplaceStart(draftId: string): void {
  const state = acquireDraftMutationState(draftId);
  state.inFlightCount += 1;
  emit();
}

export function trackCartReplaceEnd(draftId: string): void {
  const state = gates.get(draftId);
  if (state === undefined) {
    return;
  }
  state.inFlightCount = Math.max(0, state.inFlightCount - 1);
  emit();
}

export async function flushCartPendingChanges(draftId: string): Promise<boolean> {
  const state = gates.get(draftId);
  if (state === undefined) {
    return true;
  }
  state.lastFlushOk = true;
  await state.qtyTask.flush();
  await state.persistGate;
  return state.lastFlushOk;
}
