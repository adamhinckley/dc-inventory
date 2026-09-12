import type { PlatformUserId } from "@dc-inventory/shared-kernel";
import type { PlatformUser } from "../platform-user.js";

export interface IPlatformUserRepository {
  findByEmail(email: string): Promise<PlatformUser | null>;
  findById(id: PlatformUserId): Promise<PlatformUser | null>;
  save(user: PlatformUser): Promise<void>;
}
