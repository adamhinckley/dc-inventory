import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Organization } from "../domain/organization.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  private readonly byId = new Map<OrganizationId, Organization>();
  private readonly bySlug = new Map<string, Organization>();

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.byId.get(id) ?? null;
  }

  async save(organization: Organization): Promise<void> {
    const stored = { ...organization };
    this.byId.set(stored.id, stored);
    this.bySlug.set(stored.slug, stored);
  }
}
