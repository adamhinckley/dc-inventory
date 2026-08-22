import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link href="/products" className="text-lg font-semibold text-ink">
          DC Wholesale
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  );
}
