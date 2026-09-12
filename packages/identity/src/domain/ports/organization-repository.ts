import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Organization } from "../organization.js";

export interface IOrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: OrganizationId): Promise<Organization | null>;
  save(organization: Organization): Promise<void>;
  deleteById(id: OrganizationId): Promise<void>;
}
