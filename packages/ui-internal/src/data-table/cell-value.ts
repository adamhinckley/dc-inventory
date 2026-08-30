import { formatDateTime } from "@dc-inventory/ui";

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function formatFieldDisplay(
  value: unknown,
  timeZone?: string,
): unknown {
  if (typeof value === "string" && ISO_INSTANT.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateTime(
        value,
        timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
    }
  }
  return value;
}

export function readFieldValue(
  row: Record<string, unknown>,
  field: string,
): unknown {
  if (!field.includes(".")) {
    return row[field];
  }
  let current: unknown = row;
  for (const segment of field.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
