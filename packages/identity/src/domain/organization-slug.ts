const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 48;

/** Derive a URL slug from a company display name (lowercase, hyphens, max 48 chars). */
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

export function normalizeOrganizationSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isOrganizationSlugValid(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
