"use client";

import type {
  AccountingAgingBucket,
  AccountingSummaryAging,
} from "../lib/accounting-types";
import { formatMoneyMinorUnits } from "@dc-inventory/ui";
import { formatShareOfOpenArLabel } from "../lib/accounting-url-params";
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABELS,
} from "../lib/customer-accounting-format";

export function AccountingAgingStrip({
  aging,
  totalOpenArCents,
  activeBucket,
  onBucketChange,
}: {
  aging: AccountingSummaryAging;
  totalOpenArCents: number;
  activeBucket: AccountingAgingBucket | undefined;
  onBucketChange: (bucket: AccountingAgingBucket | null) => void;
}) {
  const currency = "USD";

  return (
    <div
      className="grid grid-cols-7 gap-tight"
      data-testid="accounting-aging-strip"
    >
      {AGING_BUCKET_KEYS.map((key, index) => {
        const amount = aging[key];
        const isActive = activeBucket === key;
        const late = index > 0 && amount > 0;
        const percent =
          totalOpenArCents > 0
            ? Math.round((amount / totalOpenArCents) * 100)
            : 0;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onBucketChange(isActive ? null : key)}
            className={`rounded-interactable border px-item-x py-item-y text-left transition-colors hover:bg-surface-raised ${
              isActive
                ? "border-fg bg-surface-raised"
                : late
                  ? "border-error"
                  : "border-border"
            }`}
          >
            <div className="text-caption text-fg-tertiary">
              {AGING_BUCKET_LABELS[key]}
            </div>
            <div
              className={`text-body-emphasis tabular-nums ${
                amount === 0 ? "text-fg-muted" : ""
              }`}
            >
              {amount === 0 ? "—" : formatMoneyMinorUnits(amount, currency)}
            </div>
            <div className="text-caption text-fg-tertiary">
              {amount === 0 ? "" : formatShareOfOpenArLabel(percent)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
