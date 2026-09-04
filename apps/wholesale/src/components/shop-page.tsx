import type { ReactNode } from "react";

export function ShopPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[var(--max-width-content)] px-6 py-10">
      {children}
    </div>
  );
}
