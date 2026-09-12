import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { StaffUser } from "../staff-user.js";

export interface IStaffUserRepository {
  findByEmail(organizationId: OrganizationId, email: string): Promise<StaffUser | null>;
  findById(id: StaffUserId): Promise<StaffUser | null>;
  save(user: StaffUser): Promise<void>;
  deleteById(id: StaffUserId): Promise<void>;
}
