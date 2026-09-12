import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export interface ICustomerOccupancyReadPort {
  hasOccupancy(organizationId: OrganizationId, customerId: CustomerId): Promise<boolean>;
}

export class InMemoryCustomerOccupancyReadPort implements ICustomerOccupancyReadPort {
  private readonly occupied = new Set<string>();

  markOccupied(organizationId: OrganizationId, customerId: CustomerId): void {
    this.occupied.add(`${organizationId}:${customerId}`);
  }

  async hasOccupancy(organizationId: OrganizationId, customerId: CustomerId): Promise<boolean> {
    return this.occupied.has(`${organizationId}:${customerId}`);
  }
}
