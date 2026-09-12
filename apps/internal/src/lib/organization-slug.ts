/** Mirrors `deriveOrganizationSlugFromDisplayName` in @dc-inventory/identity. */
export function deriveOrganizationSlugFromDisplayName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
