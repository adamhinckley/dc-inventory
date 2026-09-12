import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Organization } from "../domain/organization.js";
import { parseOrganizationName } from "../domain/required-text.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";

export type InMemoryOrganizationSnapshot = {
  byId: Map<OrganizationId, Organization>;
  bySlug: Map<string, Organization>;
};

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  private byId = new Map<OrganizationId, Organization>();
  private bySlug = new Map<string, Organization>();

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.byId.get(id) ?? null;
  }

  async save(organization: Organization): Promise<void> {
    const stored = {
      ...organization,
      name: parseOrganizationName(organization.name),
    };
    this.byId.set(stored.id, stored);
    this.bySlug.set(stored.slug, stored);
  }

  async deleteById(id: OrganizationId): Promise<void> {
    const organization = this.byId.get(id);
    if (organization === undefined) {
      return;
    }
    this.byId.delete(id);
    this.bySlug.delete(organization.slug);
  }

  createSnapshot(): InMemoryOrganizationSnapshot {
    return {
      byId: new Map(this.byId),
      bySlug: new Map(this.bySlug),
    };
  }

  restoreSnapshot(snapshot: InMemoryOrganizationSnapshot): void {
    this.byId = new Map(snapshot.byId);
    this.bySlug = new Map(snapshot.bySlug);
  }
}
