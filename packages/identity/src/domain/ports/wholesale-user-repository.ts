import type {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { WholesaleUser } from "../wholesale-user.js";

export interface IWholesaleUserRepository {
  findByEmail(organizationId: OrganizationId, email: string): Promise<WholesaleUser | null>;
  findById(id: WholesaleUserId): Promise<WholesaleUser | null>;
  listCustomerIdsWithWholesaleUsers(organizationId: OrganizationId): Promise<readonly CustomerId[]>;
  save(user: WholesaleUser): Promise<void>;
}
