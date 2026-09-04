import type { ReactNode } from "react";
import { ShopFooter } from "./shop-footer";
import { ShopHeader } from "./shop-header";

export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ShopHeader />
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}
