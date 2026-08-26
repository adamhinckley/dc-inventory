import type { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";

export type Supplier = {
  readonly id: SupplierId;
  readonly organizationId: OrganizationId;
  readonly vendorNumber: string;
  readonly name: string;
};
