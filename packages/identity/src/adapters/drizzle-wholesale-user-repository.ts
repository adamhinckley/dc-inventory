import {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import { normalizeEmail } from "../domain/email.js";
import { parseDisplayName } from "../domain/required-text.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { WholesaleUser } from "../domain/wholesale-user.js";
import { wholesaleUsers } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleWholesaleUserRepository implements IWholesaleUserRepository {
  constructor(private readonly db: IdentityDrizzle) {}

  async findByEmail(
    organizationId: OrganizationId,
    email: string,
  ): Promise<WholesaleUser | null> {
    const rows = await this.db
      .select()
      .from(wholesaleUsers)
      .where(
        and(
          eq(wholesaleUsers.organizationId, organizationId),
          eq(wholesaleUsers.email, normalizeEmail(email)),
        ),
      )
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

  async listCustomerIdsWithWholesaleUsers(
    organizationId: OrganizationId,
  ): Promise<readonly CustomerId[]> {
    const rows = await this.db
      .select({ customerId: wholesaleUsers.customerId })
      .from(wholesaleUsers)
      .where(eq(wholesaleUsers.organizationId, organizationId));
    const ids = new Set<CustomerId>();
    for (const row of rows) {
      ids.add(CustomerId.parse(row.customerId));
    }
    return [...ids];
  }

  async save(user: WholesaleUser): Promise<void> {
    const email = normalizeEmail(user.email);
    const displayName = parseDisplayName(user.displayName);
    await this.db
      .insert(wholesaleUsers)
      .values({
        id: user.id,
        organizationId: user.organizationId,
        displayName,
        email,
        passwordHash: user.passwordHash,
        customerId: user.customerId,
      })
      .onConflictDoUpdate({
        target: wholesaleUsers.id,
        set: {
          organizationId: user.organizationId,
          displayName,
          email,
          passwordHash: user.passwordHash,
          customerId: user.customerId,
          updatedAt: new Date(),
        },
      });
  }

  async deleteById(id: WholesaleUserId): Promise<void> {
    await this.db.delete(wholesaleUsers).where(eq(wholesaleUsers.id, id));
  }
}

function toWholesaleUser(row: typeof wholesaleUsers.$inferSelect): WholesaleUser {
  return {
    id: WholesaleUserId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    displayName: row.displayName,
    email: row.email,
    passwordHash: row.passwordHash,
    customerId: CustomerId.parse(row.customerId),
  };
}
