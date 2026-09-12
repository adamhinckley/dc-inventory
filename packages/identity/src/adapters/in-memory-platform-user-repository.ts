import { PlatformUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { IPlatformUserRepository } from "../domain/ports/platform-user-repository.js";
import type { PlatformUser } from "../domain/platform-user.js";

export class InMemoryPlatformUserRepository implements IPlatformUserRepository {
  private readonly byId = new Map<PlatformUserId, PlatformUser>();
  private readonly byEmail = new Map<string, PlatformUserId>();

  async findByEmail(email: string): Promise<PlatformUser | null> {
    const id = this.byEmail.get(normalizeEmail(email));
    if (id === undefined) {
      return null;
    }
    return this.byId.get(id) ?? null;
  }

  async findById(id: PlatformUserId): Promise<PlatformUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: PlatformUser): Promise<void> {
    const email = normalizeEmail(user.email);
    this.byId.set(user.id, { ...user, email });
    this.byEmail.set(email, user.id);
  }
}
