"use client";

import { useSyncExternalStore } from "react";

/** Open/closed state of the slide-in cart drawer, shared by header and Add to Cart. */
let open = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(next: boolean) {
  if (open === next) {
    return;
  }
  open = next;
  for (const listener of listeners) {
    listener();
  }
}

export function openCartDrawer(): void {
  set(true);
}

export function closeCartDrawer(): void {
  set(false);
}

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
