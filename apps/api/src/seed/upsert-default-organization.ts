import type { IOrganizationRepository } from "@dc-inventory/identity";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { PHASE1_ORGANIZATION_NAME, PHASE1_ORGANIZATION_SLUG } from "./phase1-fixture.js";
import { Phase1SeedError } from "./run-phase1-seed.js";

export async function upsertDefaultOrganization(
  organizations: IOrganizationRepository,
): Promise<void> {
  const existing = await organizations.findBySlug(PHASE1_ORGANIZATION_SLUG);
  if (existing !== null && existing.id !== OrganizationId.DEFAULT) {
    throw new Phase1SeedError(
      `Phase 1 organization slug ${PHASE1_ORGANIZATION_SLUG} is already bound to another organization`,
    );
  }
  await organizations.save({
    id: OrganizationId.DEFAULT,
    slug: PHASE1_ORGANIZATION_SLUG,
    name: PHASE1_ORGANIZATION_NAME,
  });
}
