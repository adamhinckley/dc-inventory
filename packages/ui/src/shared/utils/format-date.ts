import { formatDate as formatDateDisplay } from "../../lib/format-date";

export function formatDate(
  value: string,
  format: "long" | "short" = "long",
): string {
  if (format === "short") {
    const date = new Date(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  return formatDateDisplay(value, "UTC");
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
