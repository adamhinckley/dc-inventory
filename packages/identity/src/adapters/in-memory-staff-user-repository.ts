import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import { parseDisplayName } from "../domain/required-text.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffUser } from "../domain/staff-user.js";

function emailKey(organizationId: OrganizationId, email: string): string {
  return `${organizationId}:${normalizeEmail(email)}`;
}

export type InMemoryStaffUserSnapshot = {
  byId: Map<StaffUserId, StaffUser>;
  byOrgEmail: Map<string, StaffUser>;
};

export class InMemoryStaffUserRepository implements IStaffUserRepository {
  private byId = new Map<StaffUserId, StaffUser>();
  private byOrgEmail = new Map<string, StaffUser>();

  async findByEmail(organizationId: OrganizationId, email: string): Promise<StaffUser | null> {
    return this.byOrgEmail.get(emailKey(organizationId, email)) ?? null;
  }

  async findById(id: StaffUserId): Promise<StaffUser | null> {
    return this.byId.get(id) ?? null;
  }

  async save(user: StaffUser): Promise<void> {
    const stored = {
      ...user,
      displayName: parseDisplayName(user.displayName),
      email: normalizeEmail(user.email),
      roles: [...user.roles],
    };
    this.byId.set(stored.id, stored);
    this.byOrgEmail.set(emailKey(stored.organizationId, stored.email), stored);
  }

  async deleteById(id: StaffUserId): Promise<void> {
    const user = this.byId.get(id);
    if (user === undefined) {
      return;
    }
    this.byId.delete(id);
    this.byOrgEmail.delete(emailKey(user.organizationId, user.email));
  }

  createSnapshot(): InMemoryStaffUserSnapshot {
    return {
      byId: new Map(this.byId),
      byOrgEmail: new Map(this.byOrgEmail),
    };
  }

  restoreSnapshot(snapshot: InMemoryStaffUserSnapshot): void {
    this.byId = new Map(snapshot.byId);
    this.byOrgEmail = new Map(snapshot.byOrgEmail);
  }
}
