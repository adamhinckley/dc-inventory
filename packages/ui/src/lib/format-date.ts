/**
 * Display-only date formatters. No domain calendar math.
 * Pass `timeZone` in tests so snapshots stay deterministic.
 */
export function formatDate(
  value: Date | string,
  timeZone = "UTC",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone,
  }).format(date);
}

export function formatDateTime(
  value: Date | string,
  timeZone = "UTC",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
