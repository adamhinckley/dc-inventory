import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { normalizeEmail } from "../domain/email.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { StaffUser } from "../domain/staff-user.js";
import {
  opsUsers,
  organizations,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "../persistence/schema.js";

export type IdentityDrizzle = PostgresJsDatabase<{
  organizations: typeof organizations;
  opsUsers: typeof opsUsers;
  staffUsers: typeof staffUsers;
  wholesaleUsers: typeof wholesaleUsers;
  sessions: typeof sessions;
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
    await this.db
      .insert(staffUsers)
      .values({
        id: user.id,
        organizationId: user.organizationId,
        email,
        passwordHash: user.passwordHash,
      })
      .onConflictDoUpdate({
        target: staffUsers.id,
        set: {
          organizationId: user.organizationId,
          email,
          passwordHash: user.passwordHash,
          updatedAt: new Date(),
        },
      });
  }
}

function toStaffUser(row: typeof staffUsers.$inferSelect): StaffUser {
  return {
    id: StaffUserId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    email: row.email,
    passwordHash: row.passwordHash,
  };
}
