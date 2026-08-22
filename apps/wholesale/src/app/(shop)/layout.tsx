import type { ReactNode } from "react";
import { ShopHeader } from "../../components/shop-header";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ShopHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      <footer className="border-t border-line px-6 py-6 text-center text-sm text-ink-muted">
        Wholesale client shop — not the staff dashboard.
      </footer>
    </div>
  );
}
