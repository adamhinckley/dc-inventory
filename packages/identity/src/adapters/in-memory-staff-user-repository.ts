import type { StaffUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffUser } from "../domain/staff-user.js";

export class InMemoryStaffUserRepository implements IStaffUserRepository {
  private readonly byId = new Map<StaffUserId, StaffUser>();
  private readonly byEmail = new Map<string, StaffUser>();

  async findByEmail(email: string): Promise<StaffUser | null> {
    return this.byEmail.get(normalizeEmail(email)) ?? null;
  }

  async findById(id: StaffUserId): Promise<StaffUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: StaffUser): Promise<void> {
    const stored = { ...user, email: normalizeEmail(user.email) };
    this.byId.set(stored.id, stored);
    this.byEmail.set(stored.email, stored);
  }
}
