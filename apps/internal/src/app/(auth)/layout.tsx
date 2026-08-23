import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <header className="border-b border-border-subtle px-region-x py-region-y">
        <Link href="/catalog" className="text-title-sm text-fg">
          DC Internal
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-region-x py-page-section">
        {children}
      </main>
    </div>
  );
}
