import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { StaffUser } from "../staff-user.js";

export interface IStaffUserRepository {
  findByEmail(email: string): Promise<StaffUser | null>;
  findById(id: StaffUserId): Promise<StaffUser | null>;
  save(user: StaffUser): Promise<void>;
}
