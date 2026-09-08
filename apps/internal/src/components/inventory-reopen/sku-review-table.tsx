"use client";

import { Checkbox } from "@dc-inventory/ui";
import type { InventoryMatchRow } from "../../lib/inventory-reopen-workflow";
import { isEligibleForSellWindowApply } from "../../lib/inventory-reopen-workflow";
import { VirtualRows } from "./virtual-rows";

export function SkuReviewTable({
  items,
  checkedSkus,
  onToggle,
  readOnly = false,
  loading = false,
  onVisibleRange,
}: {
  items: readonly InventoryMatchRow[];
  checkedSkus: Record<string, boolean>;
  onToggle: (sku: string, checked: boolean) => void;
  readOnly?: boolean;
  loading?: boolean;
  onVisibleRange?: (range: { startIndex: number; endIndex: number }) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-section border border-border">
      <div className="grid shrink-0 grid-cols-[2.5rem_8rem_minmax(0,1fr)_10rem_6rem_5rem_5rem_6rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
        <span />
        <span>SKU</span>
        <span>Name</span>
        <span>Factory</span>
        <span>State</span>
        <span>On Hand</span>
        <span>On Order</span>
        <span>Flags</span>
      </div>
      {loading && items.length === 0 ? (
        <p className="px-3 py-4 text-body-sm text-fg-secondary">Loading matches…</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-body-sm text-fg-secondary">No matching SKUs.</p>
      ) : (
        <VirtualRows
          items={items}
          estimateSize={36}
          className="h-[min(36rem,calc(100dvh-18rem))] overflow-auto"
          onVisibleRange={onVisibleRange}
        >
          {(row) => (
            <SkuReviewRow
              row={row}
              checked={checkedSkus[row.sku] !== false && isEligibleForSellWindowApply(row)}
              readOnly={readOnly}
              onToggle={onToggle}
            />
          )}
        </VirtualRows>
      )}
    </div>
  );
}

function SkuReviewRow({
  row,
  checked,
  readOnly,
  onToggle,
}: {
  row: InventoryMatchRow;
  checked: boolean;
  readOnly: boolean;
  onToggle: (sku: string, checked: boolean) => void;
}) {
  const eligible = isEligibleForSellWindowApply(row);
  return (
    <div className="grid h-full grid-cols-[2.5rem_8rem_minmax(0,1fr)_10rem_6rem_5rem_5rem_6rem] items-center gap-x-3 border-b border-border px-3 text-body-sm">
      <Checkbox
        checked={checked}
        disabled={!eligible || readOnly}
        onChange={(value) => onToggle(row.sku, value)}
        aria-label={`Include ${row.sku}`}
      />
      <span className="font-mono">{row.sku}</span>
      <span className="truncate">{row.name}</span>
      <span className="truncate">{row.supplierName ?? ""}</span>
      <span>{row.sellState}</span>
      <span>{row.onHand}</span>
      <span>{row.onOrder}</span>
      <span className="text-fg-secondary">
        {row.inactive ? "inactive " : ""}
        {row.discontinued ? "disc." : ""}
        {!row.inactive && !row.discontinued ? "—" : ""}
      </span>
    </div>
  );
}
