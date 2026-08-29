import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { OpsUser, OpsUserId } from "../ops-user.js";

export interface IOpsUserRepository {
  findByEmail(tenantId: OrganizationId, email: string): Promise<OpsUser | null>;
  findById(id: OpsUserId): Promise<OpsUser | null>;
  save(user: OpsUser): Promise<void>;
}
