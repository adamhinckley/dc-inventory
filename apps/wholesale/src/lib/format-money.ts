/**
 * Display-only formatter. Minor units stay integers; this does not compute tax
 * or invent a rate. Currency exponent comes from Intl (USD=2, JPY=0).
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
