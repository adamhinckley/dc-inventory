import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export interface ILastOrderDateReadPort {
  getLastOrderDate(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Date | null>;
}
