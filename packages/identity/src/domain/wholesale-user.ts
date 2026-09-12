import type {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";

export type WholesaleUser = {
  id: WholesaleUserId;
  organizationId: OrganizationId;
  displayName: string;
  email: string;
  passwordHash: string;
  customerId: CustomerId;
};
