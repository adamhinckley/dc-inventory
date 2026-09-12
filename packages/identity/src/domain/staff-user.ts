import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { StaffRole } from "./staff-role.js";

export type StaffUser = {
  id: StaffUserId;
  organizationId: OrganizationId;
  displayName: string;
  email: string;
  passwordHash: string;
  roles: readonly StaffRole[];
};
