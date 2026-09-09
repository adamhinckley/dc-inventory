import { formatDate, formatMoneyMinorUnits } from "@dc-inventory/ui";
import type { CustomerAccountingSummary } from "./customer-accounting-types";

export const AGING_BUCKET_KEYS = [
  "current",
  "1-15",
  "16-30",
  "31-45",
  "46-60",
  "61-90",
  "90+",
] as const;

export const AGING_BUCKET_LABELS: Record<(typeof AGING_BUCKET_KEYS)[number], string> = {
  current: "Current",
  "1-15": "1–15",
  "16-30": "16–30",
  "31-45": "31–45",
  "46-60": "46–60",
  "61-90": "61–90",
  "90+": "90+",
};

export function sumPastDueCents(
  aging: CustomerAccountingSummary["aging"],
): number {
  return AGING_BUCKET_KEYS.slice(1).reduce(
    (sum, key) => sum + aging[key],
    0,
  );
}

export function parseDollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function formatCentsInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNullableDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return formatDate(value, "UTC");
}

export function formatNullableMoney(
  cents: number | null | undefined,
  currency: string,
): string {
  if (cents === null || cents === undefined) {
    return "—";
  }
  return formatMoneyMinorUnits(cents, currency);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded}%`;
}
