"use client";

import type { AccountingSummary } from "../lib/accounting-types";
import { formatMoneyMinorUnits } from "@dc-inventory/ui";
import { formatPastDuePercentLabel } from "../lib/accounting-url-params";

export function AccountingKpiStrip({
  summary,
}: {
  summary: AccountingSummary;
}) {
  const currency = "USD";
  const tiles = [
    {
      label: "Total open AR",
      value: formatMoneyMinorUnits(summary.totalOpenArCents, currency),
      sub: undefined as string | undefined,
      tone: undefined as "error" | undefined,
    },
    {
      label: "Past due",
      value: formatMoneyMinorUnits(summary.pastDueCents, currency),
      sub: formatPastDuePercentLabel(summary.pastDuePercent),
      tone: summary.pastDueCents > 0 ? ("error" as const) : undefined,
    },
    {
      label: "Unapplied credit",
      value: formatMoneyMinorUnits(summary.unappliedCreditCents, currency),
      sub: undefined,
      tone: undefined,
    },
    {
      label: "MTD write-offs",
      value: formatMoneyMinorUnits(summary.mtdWriteOffsCents, currency),
      sub: undefined,
      tone: undefined,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-tight lg:grid-cols-4"
      data-testid="accounting-kpi-strip"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-tight rounded-section border border-border bg-surface-card-raised p-card"
        >
          <span className="section-content-label">{tile.label}</span>
          <span
            className={`text-title-md tabular-nums ${
              tile.tone === "error" ? "text-error" : "text-fg"
            }`}
          >
            {tile.value}
          </span>
          {tile.sub ? (
            <span className="text-body-sm text-fg-secondary">{tile.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
