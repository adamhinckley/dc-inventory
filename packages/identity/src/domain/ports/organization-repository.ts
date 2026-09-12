import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Organization } from "../organization.js";

export type ListOrganizationsQuery = {
  q?: string;
  page: number;
  pageSize: number;
  sortBy: "name" | "slug" | "id";
  sortOrder: "asc" | "desc";
};

export type OrganizationListPage = {
  items: readonly Organization[];
  total: number;
};

export interface IOrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: OrganizationId): Promise<Organization | null>;
  save(organization: Organization): Promise<void>;
  deleteById(id: OrganizationId): Promise<void>;
  list(query: ListOrganizationsQuery): Promise<OrganizationListPage>;
}
