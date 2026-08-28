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
