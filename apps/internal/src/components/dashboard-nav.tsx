"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "../lib/dashboard-routes";

/** Kept for tests that still read this file; chrome lives in `dashboard-frame`. */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="flex w-sidebar-expanded shrink-0 flex-col px-action">
      <div className="flex items-start justify-between gap-icon border-b border-border-subtle px-region-x py-region-y">
        <Link href="/catalog" className="flex flex-col">
          <span className="text-title-sm text-fg">DC Internal</span>
          <span className="text-body-sm text-fg-secondary">Staff dashboard</span>
        </Link>
        <Link
          href="/login"
          className="shrink-0 text-body-sm text-link hover:text-link-hover"
        >
          Sign in
        </Link>
      </div>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-tight p-tight">
        {dashboardNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "interactable item-padding shell-nav-item-active bg-selected"
                  : "interactable ghost item-padding shell-nav-item"
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
