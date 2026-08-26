import type { OrganizationId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { WholesaleUser } from "../domain/wholesale-user.js";

function emailKey(organizationId: OrganizationId, email: string): string {
  return `${organizationId}:${normalizeEmail(email)}`;
}

export class InMemoryWholesaleUserRepository implements IWholesaleUserRepository {
  private readonly byId = new Map<WholesaleUserId, WholesaleUser>();
  private readonly byOrgEmail = new Map<string, WholesaleUser>();

  async findByEmail(organizationId: OrganizationId, email: string): Promise<WholesaleUser | null> {
    return this.byOrgEmail.get(emailKey(organizationId, email)) ?? null;
  }

  async findById(id: WholesaleUserId): Promise<WholesaleUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: WholesaleUser): Promise<void> {
    const stored = { ...user, email: normalizeEmail(user.email) };
    this.byId.set(stored.id, stored);
    this.byOrgEmail.set(emailKey(stored.organizationId, stored.email), stored);
  }
}
