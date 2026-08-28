import type { ReactNode } from "react";

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

export function formatCellValue(row: Record<string, unknown>, field: string): ReactNode {
  const value = readFieldValue(row, field);
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value);
}
