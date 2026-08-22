import type { ReactNode } from "react";
import { DashboardNav } from "../../components/dashboard-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-8 py-8">{children}</main>
        <footer className="border-t border-border-subtle px-8 py-4 text-sm text-helper">
          Staff dashboard — not the wholesale shop.
        </footer>
      </div>
    </div>
  );
}
