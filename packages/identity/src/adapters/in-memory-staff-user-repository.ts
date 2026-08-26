import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffUser } from "../domain/staff-user.js";

function emailKey(organizationId: OrganizationId, email: string): string {
  return `${organizationId}:${normalizeEmail(email)}`;
}

export class InMemoryStaffUserRepository implements IStaffUserRepository {
  private readonly byId = new Map<StaffUserId, StaffUser>();
  private readonly byOrgEmail = new Map<string, StaffUser>();

  async findByEmail(organizationId: OrganizationId, email: string): Promise<StaffUser | null> {
    return this.byOrgEmail.get(emailKey(organizationId, email)) ?? null;
  }

  async findById(id: StaffUserId): Promise<StaffUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: StaffUser): Promise<void> {
    const stored = { ...user, email: normalizeEmail(user.email) };
    this.byId.set(stored.id, stored);
    this.byOrgEmail.set(emailKey(stored.organizationId, stored.email), stored);
  }
}
