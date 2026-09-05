/** Coerce postgres.js bigint/text cent values to a JS number for API responses. */
export function normalizeCents(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}
