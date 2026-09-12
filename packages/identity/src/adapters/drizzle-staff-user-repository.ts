import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { normalizeEmail } from "../domain/email.js";
import { parseDisplayName } from "../domain/required-text.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffUser } from "../domain/staff-user.js";
import {
  loginThrottleCounters,
  opsUsers,
  organizations,
  platformUsers,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "../persistence/schema.js";

export type IdentityDrizzle = PostgresJsDatabase<{
  organizations: typeof organizations;
  opsUsers: typeof opsUsers;
  platformUsers: typeof platformUsers;
  staffUsers: typeof staffUsers;
  wholesaleUsers: typeof wholesaleUsers;
  sessions: typeof sessions;
  loginThrottleCounters: typeof loginThrottleCounters;
}>;

export class DrizzleStaffUserRepository implements IStaffUserRepository {
  constructor(private readonly db: IdentityDrizzle) {}

  async findByEmail(organizationId: OrganizationId, email: string): Promise<StaffUser | null> {
    const rows = await this.db
      .select()
      .from(staffUsers)
      .where(
        and(
          eq(staffUsers.organizationId, organizationId),
          eq(staffUsers.email, normalizeEmail(email)),
        ),
      )
      .limit(1);
    return rows[0] === undefined ? null : toStaffUser(rows[0]);
  }

  async findByEmailGlobally(email: string): Promise<StaffUser | null> {
    const rows = await this.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, normalizeEmail(email)))
      .limit(1);
    return rows[0] === undefined ? null : toStaffUser(rows[0]);
  }

  async findById(id: StaffUserId): Promise<StaffUser | null> {
    const rows = await this.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toStaffUser(rows[0]);
  }

  async save(user: StaffUser): Promise<void> {
    const email = normalizeEmail(user.email);
    const displayName = parseDisplayName(user.displayName);
    const platformConflict = await this.db
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(eq(platformUsers.email, email))
      .limit(1);
    if (platformConflict[0] !== undefined) {
      throw new Error("email already used by platform user");
    }
    await this.db
      .insert(staffUsers)
      .values({
        id: user.id,
        organizationId: user.organizationId,
        displayName,
        email,
        passwordHash: user.passwordHash,
        roles: [...user.roles],
      })
      .onConflictDoUpdate({
        target: staffUsers.id,
        set: {
          organizationId: user.organizationId,
          displayName,
          email,
          passwordHash: user.passwordHash,
          roles: [...user.roles],
          updatedAt: new Date(),
        },
      });
  }

  async deleteById(id: StaffUserId): Promise<void> {
    await this.db.delete(staffUsers).where(eq(staffUsers.id, id));
  }
}

function toStaffUser(row: typeof staffUsers.$inferSelect): StaffUser {
  return {
    id: StaffUserId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    displayName: row.displayName,
    email: row.email,
    passwordHash: row.passwordHash,
    roles: row.roles,
  };
}
