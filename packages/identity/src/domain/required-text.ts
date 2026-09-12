export class InvalidRequiredTextError extends Error {
  override readonly name = "InvalidRequiredTextError";

  constructor(readonly field: string) {
    super(`${field} must be non-empty`);
  }
}

export function parseNonEmptyText(field: string, value: string | undefined | null): string {
  if (value === undefined || value === null) {
    throw new InvalidRequiredTextError(field);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidRequiredTextError(field);
  }
  return trimmed;
}

export function parseDisplayName(value: string | undefined | null): string {
  return parseNonEmptyText("displayName", value);
}

export function parseOrganizationName(value: string | undefined | null): string {
  return parseNonEmptyText("organization name", value);
}
