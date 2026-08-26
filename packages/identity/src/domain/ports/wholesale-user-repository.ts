import type { OrganizationId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { WholesaleUser } from "../wholesale-user.js";

export interface IWholesaleUserRepository {
  findByEmail(organizationId: OrganizationId, email: string): Promise<WholesaleUser | null>;
  findById(id: WholesaleUserId): Promise<WholesaleUser | null>;
  save(user: WholesaleUser): Promise<void>;
}
