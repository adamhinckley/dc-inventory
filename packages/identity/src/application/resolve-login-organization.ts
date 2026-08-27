import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { normalizeOrganizationSlug } from "../domain/organization-slug.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";

export async function resolveLoginOrganizationId(
  organizations: IOrganizationRepository,
  rawSlug: string,
): Promise<OrganizationId | null> {
  const slug = normalizeOrganizationSlug(rawSlug);
  if (slug.length === 0) {
    return null;
  }
  const organization = await organizations.findBySlug(slug);
  return organization?.id ?? null;
}
