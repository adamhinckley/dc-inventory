/**
 * Display-only money formatter. Does not compute tax, convert FX, or
 * construct shared-kernel `Money`. Currency exponent comes from Intl.
 */
export function formatMoneyMinorUnits(
  minorUnits: number,
  currency: string,
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** digits);
}
