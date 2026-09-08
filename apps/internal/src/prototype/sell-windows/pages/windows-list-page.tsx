"use client";

import Link from "next/link";
import { buttonVariants, cn, formatDate } from "@dc-inventory/ui";
import { Plus } from "lucide-react";
import { sellWindowsPrototypeHref } from "../prototype-href";
import { useSellWindowsPrototype } from "../sell-windows-prototype-context";
import { PrototypeBanner } from "../shared/prototype-banner";
import { PrototypeDevTools } from "../shared/prototype-dev-tools";
import { WindowStatusChip } from "../shared/window-status-chip";

export function SellWindowsListPage() {
  const store = useSellWindowsPrototype();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section pb-8">
      <PrototypeBanner />
      <div className="flex flex-wrap items-center justify-between gap-field-group">
        <div>
          <h2 className="text-heading-sm">Sell Windows</h2>
          <p className="text-body-sm text-fg-secondary">
            Saved infinity seasons. Open a window to review SKUs or close early.
          </p>
        </div>
        <Link
          href={sellWindowsPrototypeHref("/inventory/reopen/new")}
          className={cn(buttonVariants({ variant: "primary" }))}
        >
          <Plus className="size-icon" aria-hidden />
          New Window
        </Link>
      </div>

      <div className="overflow-hidden rounded-section border border-border">
        <div className="grid grid-cols-[minmax(0,1.4fr)_6rem_7rem_7rem_4rem_minmax(0,1fr)_8rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
          <span>Name</span>
          <span>Status</span>
          <span>Opens</span>
          <span>Closes</span>
          <span>SKUs</span>
          <span>Applied by</span>
          <span />
        </div>
        {store.windows.length === 0 ? (
          <p className="px-3 py-6 text-body-sm text-fg-secondary">
            No sell windows yet. Create one to open infinity for a category block.
          </p>
        ) : (
          store.windows.map((window) => (
            <div
              key={window.id}
              className="grid grid-cols-[minmax(0,1.4fr)_6rem_7rem_7rem_4rem_minmax(0,1fr)_8rem] items-center gap-x-3 border-b border-border px-3 py-2 text-body-sm"
            >
              <Link
                href={sellWindowsPrototypeHref(`/inventory/reopen/${window.id}`)}
                className="truncate font-medium hover:underline"
              >
                {window.name}
              </Link>
              <WindowStatusChip status={window.status} />
              <span>{formatDate(window.opensAt)}</span>
              <span>{formatDate(window.closesAt)}</span>
              <span>{window.skuIds.length}</span>
              <span className="truncate text-fg-secondary">{window.appliedBy}</span>
              <div className="flex justify-end gap-tight">
                <Link
                  href={sellWindowsPrototypeHref(`/inventory/reopen/new?clone=${window.id}`)}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  Clone
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <PrototypeDevTools />
    </div>
  );
}
