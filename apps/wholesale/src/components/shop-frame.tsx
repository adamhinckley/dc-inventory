import type { ReactNode } from "react";
import { ActingBanner } from "./acting-banner";
import { CartDrawer } from "./cart-drawer";
import { ShopFooter } from "./shop-footer";
import { ShopHeader } from "./shop-header";

export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-20">
        <ShopHeader />
        <ActingBanner />
      </div>
      <main className="flex-1">{children}</main>
      <ShopFooter />
      <CartDrawer />
    </div>
  );
}
