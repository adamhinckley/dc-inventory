"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSellWindowsStore, type SellWindowsStore } from "./use-sell-windows-store";

const SellWindowsPrototypeContext = createContext<SellWindowsStore | null>(null);

export function SellWindowsPrototypeProvider({ children }: { children: ReactNode }) {
  const store = useSellWindowsStore();
  return (
    <SellWindowsPrototypeContext.Provider value={store}>
      {children}
    </SellWindowsPrototypeContext.Provider>
  );
}

export function useSellWindowsPrototype(): SellWindowsStore {
  const store = useContext(SellWindowsPrototypeContext);
  if (store === null) {
    throw new Error("useSellWindowsPrototype requires SellWindowsPrototypeProvider");
  }
  return store;
}
