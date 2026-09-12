const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Derive a URL slug from a company display name (lowercase, hyphens, max 48 chars). */
export function deriveOrganizationSlugFromDisplayName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeOrganizationSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isOrganizationSlugValid(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
