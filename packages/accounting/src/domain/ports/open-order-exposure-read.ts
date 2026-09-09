import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type IOpenOrderExposureReadPort = {
  getOpenOrderExposureCents(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number>;
};
