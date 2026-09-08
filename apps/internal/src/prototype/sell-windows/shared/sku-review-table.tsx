"use client";

import { Checkbox } from "@dc-inventory/ui";
import {
  activeWindowNames,
  effectiveSellState,
  eligibleForBulkApply,
  shopVisible,
} from "../logic";
import type { MockSku, SellWindow } from "../types";

export function SkuReviewTable({
  skus,
  windows,
  now,
  checkedSkus,
  onToggle,
  readOnly = false,
}: {
  skus: MockSku[];
  windows: SellWindow[];
  now: Date;
  checkedSkus: Record<string, boolean>;
  onToggle: (sku: string, checked: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-section border border-border">
      <div className="grid grid-cols-[2.5rem_7rem_minmax(0,1fr)_8rem_5rem_5rem_6rem_8rem] gap-x-3 border-b border-border bg-surface-card px-3 py-2 text-label text-fg-secondary">
        <span />
        <span>SKU</span>
        <span>Name</span>
        <span>Factory</span>
        <span>State</span>
        <span>Shop</span>
        <span>Windows</span>
        <span>Flags</span>
      </div>
      <div className="max-h-[24rem] overflow-auto">
        {skus.map((sku) => {
          const eligible = eligibleForBulkApply(sku);
          const checked = checkedSkus[sku.sku] !== false && eligible;
          const state = effectiveSellState(sku, windows, now);
          const visible = shopVisible(sku, windows, now);
          const active = activeWindowNames(sku, windows, now);
          return (
            <div
              key={sku.sku}
              className="grid grid-cols-[2.5rem_7rem_minmax(0,1fr)_8rem_5rem_5rem_6rem_8rem] items-center gap-x-3 border-b border-border px-3 py-2 text-body-sm"
            >
              <Checkbox
                checked={checked}
                disabled={!eligible || readOnly}
                onChange={(value) => onToggle(sku.sku, value)}
                aria-label={`Include ${sku.sku}`}
              />
              <span className="font-mono">{sku.sku}</span>
              <span className="truncate">{sku.name}</span>
              <span className="truncate">{sku.supplierName}</span>
              <span className={state === "open" ? "text-status-open" : "text-fg-secondary"}>
                {state}
              </span>
              <span className={visible ? "text-status-open" : "text-fg-secondary"}>
                {visible ? "visible" : "hidden"}
              </span>
              <span className="truncate text-body-sm text-fg-secondary">
                {active.length > 0 ? active.join(", ") : "—"}
              </span>
              <span className="text-body-sm text-fg-secondary">
                {sku.inactive ? "inactive " : ""}
                {sku.discontinued ? "disc." : ""}
                {!sku.inactive && !sku.discontinued ? "—" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
