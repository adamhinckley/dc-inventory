import type { DeleteOrganizationResult, DeleteOrganizationUseCase } from "@dc-inventory/identity";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IOrganizationOccupancyReadPort } from "../adapters/organization-occupancy-read-port.js";
import type { IOrganizationRepository } from "@dc-inventory/identity";

export type DeleteOrganizationWithOccupancyResult =
  | DeleteOrganizationResult
  | { ok: false; reason: "org_not_empty" };

export class DeleteOrganizationWithOccupancyUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly occupancy: IOrganizationOccupancyReadPort,
    private readonly deleteOrganization: DeleteOrganizationUseCase,
  ) {}

  async execute(organizationId: OrganizationId): Promise<DeleteOrganizationWithOccupancyResult> {
    if (organizationId === OrganizationId.DEFAULT) {
      return { ok: false, reason: "default_organization" };
    }

    const organization = await this.organizations.findById(organizationId);
    if (organization === null) {
      return { ok: false, reason: "not_found" };
    }

    if (await this.occupancy.hasOccupancy(organizationId)) {
      return { ok: false, reason: "org_not_empty" };
    }

    return this.deleteOrganization.execute(organizationId);
  }
}
