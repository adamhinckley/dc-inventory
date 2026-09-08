"use client";

import Link from "next/link";
import { getListInternalSellWindowsQueryKey } from "@dc-inventory/api-client-internal";
import { buttonVariants, cn, formatDate } from "@dc-inventory/ui";
import { useQuery } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { listAllInternalSellWindows } from "../../lib/inventory-reopen-workflow";
import { WindowStatusChip } from "./window-status-chip";

export function SellWindowsList() {
  const windowsQuery = useQuery({
    queryKey: [...getListInternalSellWindowsQueryKey(), "all"],
    queryFn: () => listAllInternalSellWindows(),
  });
  const windows = windowsQuery.data?.items ?? [];
  const total = windowsQuery.data?.total ?? 0;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-form-section"
      data-testid="sell-windows-list"
    >
      <div className="flex flex-wrap items-center justify-between gap-field-group">
        <div className="min-w-0">
          <h2 className="text-heading-sm">Sell Windows</h2>
          <p className="text-body-sm text-fg-secondary">
            Saved infinity seasons. Open a window to review SKUs or close early.
          </p>
        </div>
        <Link href="/inventory/reopen/new" className={cn(buttonVariants({ variant: "primary" }))}>
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
          <span>Applied</span>
          <span />
        </div>
        {windowsQuery.isPending ? (
          <p className="px-3 py-6 text-body-sm text-fg-secondary">Loading sell windows…</p>
        ) : windowsQuery.isError ? (
          <p className="px-3 py-6 text-body-sm text-error" role="alert">
            Could not load sell windows.
          </p>
        ) : windows.length === 0 ? (
          <p className="px-3 py-6 text-body-sm text-fg-secondary">
            No sell windows yet. Create one to open infinity for a category block.
          </p>
        ) : (
          windows.map((window) => (
            <div
              key={window.id}
              className="grid grid-cols-[minmax(0,1.4fr)_6rem_7rem_7rem_4rem_minmax(0,1fr)_8rem] items-center gap-x-3 border-b border-border px-3 py-2 text-body-sm"
            >
              <Link
                href={`/inventory/reopen/${window.id}`}
                className="truncate font-medium hover:underline"
              >
                {window.name}
              </Link>
              <WindowStatusChip status={window.status} />
              <span>{window.windowOpensAt ? formatDate(window.windowOpensAt) : "—"}</span>
              <span>{formatDate(window.windowClosesAt)}</span>
              <span>{window.skuCount.toLocaleString()}</span>
              <span className="truncate text-fg-secondary">
                {formatDate(window.appliedAt)}
              </span>
              <div className="flex justify-end gap-tight">
                <Link
                  href={`/inventory/reopen/new?clone=${window.id}`}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  <Copy className="size-icon" aria-hidden />
                  Clone
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {windowsQuery.isSuccess && total > 0 ? (
        <p className="text-body-sm text-fg-secondary">
          Showing {windows.length.toLocaleString()} of {total.toLocaleString()} sell window(s).
        </p>
      ) : null}
    </section>
  );
}
