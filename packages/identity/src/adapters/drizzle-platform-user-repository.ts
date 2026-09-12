import { PlatformUserId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import { normalizeEmail } from "../domain/email.js";
import { parseDisplayName } from "../domain/required-text.js";
import type { IPlatformUserRepository } from "../domain/ports/platform-user-repository.js";
import type { PlatformUser } from "../domain/platform-user.js";
import { platformUsers, staffUsers } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzlePlatformUserRepository implements IPlatformUserRepository {
  constructor(private readonly db: IdentityDrizzle) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    const rows = await this.db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.email, normalizeEmail(email)))
      .limit(1);
    return rows[0] === undefined ? null : toPlatformUser(rows[0]);
  }

  async findById(id: PlatformUserId): Promise<PlatformUser | null> {
    const rows = await this.db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toPlatformUser(rows[0]);
  }

  async save(user: PlatformUser): Promise<void> {
    const email = normalizeEmail(user.email);
    const displayName = parseDisplayName(user.displayName);
    const staffConflict = await this.db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(eq(staffUsers.email, email))
      .limit(1);
    if (staffConflict[0] !== undefined) {
      throw new Error("email already used by staff user");
    }
    await this.db
      .insert(platformUsers)
      .values({
        id: user.id,
        displayName,
        email,
        passwordHash: user.passwordHash,
      })
      .onConflictDoUpdate({
        target: platformUsers.id,
        set: {
          displayName,
          email,
          passwordHash: user.passwordHash,
          updatedAt: new Date(),
        },
      });
  }
}

function toPlatformUser(row: typeof platformUsers.$inferSelect): PlatformUser {
  return {
    id: PlatformUserId.parse(row.id),
    displayName: row.displayName,
    email: row.email,
    passwordHash: row.passwordHash,
  };
}
