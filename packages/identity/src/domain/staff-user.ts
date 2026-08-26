import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";

export type StaffUser = {
  id: StaffUserId;
  organizationId: OrganizationId;
  email: string;
  passwordHash: string;
};
