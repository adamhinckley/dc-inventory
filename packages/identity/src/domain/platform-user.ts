import type { PlatformUserId } from "@dc-inventory/shared-kernel";

export type PlatformUser = {
  id: PlatformUserId;
  displayName: string;
  email: string;
  passwordHash: string;
};
