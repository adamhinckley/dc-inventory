import { formatDateTime } from "@dc-inventory/ui";

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Demand-model cells: open ATS is null; sell state is an API enum. */
export function formatStockField(field: string, value: unknown): unknown {
  if (field === "availableToSell" && (value === null || value === undefined)) {
    return "Open";
  }
  if (field === "sellState") {
    if (value === "open") {
      return "Open";
    }
    if (value === "locked") {
      return "Locked";
    }
  }
  return formatFieldDisplay(value);
}

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
