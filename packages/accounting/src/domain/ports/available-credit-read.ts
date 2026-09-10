import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";

export type AvailableCreditReadRequest = {
  readonly organizationId: OrganizationId;
  readonly customerId: CustomerId;
  readonly asOf: Date;
};

export type IAvailableCreditReadPort = {
  getAvailableCreditCents(request: AvailableCreditReadRequest): Promise<number>;
};
