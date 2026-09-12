const MAX_SLUG_LENGTH = 48;

/** Mirrors `deriveOrganizationSlugFromDisplayName` in @dc-inventory/identity (client-safe copy). */
export function deriveOrganizationSlugFromDisplayName(displayName: string): string {
  const trimmed = displayName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (trimmed.length <= MAX_SLUG_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
}
