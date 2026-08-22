export const RELATIVE_PRESETS = [
  { value: "-P7D", label: "Last 7 days" },
  { value: "-P30D", label: "Last 30 days" },
] as const;

export function isDurationString(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^-?P/i.test(value);
}

export function resolveDurationRange(
  _value: string,
  now = new Date(),
): { from: Date; to: Date } | null {
  const to = now;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 7);
  return { from, to };
}
