"use client";

import { useCallback, useSyncExternalStore } from "react";
import { activeCartStorageKey, NEW_CART, type StoredActiveCart } from "./active-cart";

/**
 * Tiny external store so the header badge, drawer, cards, and cart pages all
 * agree on the active cart without prop drilling. Persists per customer in
 * localStorage; other tabs pick it up through the storage event.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, StoredActiveCart>();

function readStorage(key: string): StoredActiveCart {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === "") {
      return null;
    }
    return raw === NEW_CART ? NEW_CART : raw;
  } catch {
    return null;
  }
}

function getSnapshot(key: string): StoredActiveCart {
  if (!memory.has(key)) {
    memory.set(key, readStorage(key));
  }
  return memory.get(key) ?? null;
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key.startsWith("wholesale.activeCart.")) {
      memory.delete(event.key);
      emit();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function setStoredActiveCart(customerId: string, value: StoredActiveCart): void {
  const key = activeCartStorageKey(customerId);
  memory.set(key, value);
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Private mode or quota: in-memory value still drives this tab.
  }
  emit();
}

export function useStoredActiveCart(customerId: string | null): StoredActiveCart {
  const key = customerId === null ? null : activeCartStorageKey(customerId);
  const read = useCallback(() => (key === null ? null : getSnapshot(key)), [key]);
  return useSyncExternalStore(subscribe, read, () => null);
}
