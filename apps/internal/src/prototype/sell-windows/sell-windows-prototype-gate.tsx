"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { isSellWindowsPrototypeVariant } from "./prototype-href";
import { SellWindowsPrototypeProvider } from "./sell-windows-prototype-context";

export function SellWindowsPrototypeGate({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant");

  if (!isSellWindowsPrototypeVariant(variant)) {
    return children;
  }

  return <SellWindowsPrototypeProvider>{children}</SellWindowsPrototypeProvider>;
}
