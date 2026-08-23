import type { WholesaleUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { WholesaleUser } from "../domain/wholesale-user.js";

export class InMemoryWholesaleUserRepository implements IWholesaleUserRepository {
  private readonly byId = new Map<WholesaleUserId, WholesaleUser>();
  private readonly byEmail = new Map<string, WholesaleUser>();

  async findByEmail(email: string): Promise<WholesaleUser | null> {
    return this.byEmail.get(normalizeEmail(email)) ?? null;
  }

  async findById(id: WholesaleUserId): Promise<WholesaleUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: WholesaleUser): Promise<void> {
    const stored = { ...user, email: normalizeEmail(user.email) };
    this.byId.set(stored.id, stored);
    this.byEmail.set(stored.email, stored);
  }
}
