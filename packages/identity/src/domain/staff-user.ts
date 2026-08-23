import type { StaffUserId } from "@dc-inventory/shared-kernel";

export type StaffUser = {
  id: StaffUserId;
  email: string;
  passwordHash: string;
};
