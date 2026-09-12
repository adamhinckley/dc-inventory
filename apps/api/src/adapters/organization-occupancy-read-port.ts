import type { OrganizationId } from "@dc-inventory/shared-kernel";

export interface IOrganizationOccupancyReadPort {
  hasOccupancy(organizationId: OrganizationId): Promise<boolean>;
}

export class InMemoryOrganizationOccupancyReadPort implements IOrganizationOccupancyReadPort {
  private readonly occupied = new Set<string>();

  markOccupied(organizationId: OrganizationId): void {
    this.occupied.add(organizationId);
  }

  async hasOccupancy(organizationId: OrganizationId): Promise<boolean> {
    return this.occupied.has(organizationId);
  }
}
