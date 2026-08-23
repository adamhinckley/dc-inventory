import { CustomerId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import { normalizeEmail } from "../domain/email.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { WholesaleUser } from "../domain/wholesale-user.js";
import { wholesaleUsers } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleWholesaleUserRepository implements IWholesaleUserRepository {
  constructor(private readonly db: IdentityDrizzle) {}

  async findByEmail(email: string): Promise<WholesaleUser | null> {
    const rows = await this.db
      .select()
      .from(wholesaleUsers)
      .where(eq(wholesaleUsers.email, normalizeEmail(email)))
      .limit(1);
    return rows[0] === undefined ? null : toWholesaleUser(rows[0]);
  }

  async findById(id: WholesaleUserId): Promise<WholesaleUser | null> {
    const rows = await this.db
      .select()
      .from(wholesaleUsers)
      .where(eq(wholesaleUsers.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toWholesaleUser(rows[0]);
  }

  async save(user: WholesaleUser): Promise<void> {
    const email = normalizeEmail(user.email);
    await this.db
      .insert(wholesaleUsers)
      .values({
        id: user.id,
        email,
        passwordHash: user.passwordHash,
        customerId: user.customerId,
      })
      .onConflictDoUpdate({
        target: wholesaleUsers.id,
        set: {
          email,
          passwordHash: user.passwordHash,
          customerId: user.customerId,
          updatedAt: new Date(),
        },
      });
  }
}

function toWholesaleUser(row: typeof wholesaleUsers.$inferSelect): WholesaleUser {
  return {
    id: WholesaleUserId.parse(row.id),
    email: row.email,
    passwordHash: row.passwordHash,
    customerId: CustomerId.parse(row.customerId),
  };
}
