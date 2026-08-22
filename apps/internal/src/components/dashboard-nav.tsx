"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "../lib/dashboard-routes";

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-layer-01">
      <div className="flex items-start justify-between gap-2 border-b border-border-subtle px-5 py-5">
        <Link href="/catalog" className="flex flex-col">
          <span className="text-base font-semibold text-primary">
            DC Internal
          </span>
          <span className="text-sm text-secondary">Staff dashboard</span>
        </Link>
        <Link
          href="/login"
          className="shrink-0 text-sm text-link hover:text-link-hover"
        >
          Sign in
        </Link>
      </div>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 p-3">
        {dashboardNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "rounded-sm bg-layer-selected-01 px-3 py-2 text-sm font-medium text-primary"
                  : "rounded-sm px-3 py-2 text-sm text-primary hover:bg-layer-hover-01"
              }
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
