import { OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import { normalizeEmail } from "../domain/email.js";
import { OpsUserId, type OpsUser } from "../domain/ops-user.js";
import type { IOpsUserRepository } from "../domain/ports/ops-user-repository.js";
import { opsUsers } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleOpsUserRepository implements IOpsUserRepository {
  constructor(private readonly db: IdentityDrizzle) {}

  async findByEmail(tenantId: OrganizationId, email: string): Promise<OpsUser | null> {
    const rows = await this.db
      .select()
      .from(opsUsers)
      .where(
        and(
          eq(opsUsers.tenantId, tenantId),
          eq(opsUsers.email, normalizeEmail(email)),
        ),
      )
      .limit(1);
    return rows[0] === undefined ? null : toOpsUser(rows[0]);
  }

  async findById(id: OpsUserId): Promise<OpsUser | null> {
    const rows = await this.db
      .select()
      .from(opsUsers)
      .where(eq(opsUsers.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toOpsUser(rows[0]);
  }

  async save(user: OpsUser): Promise<void> {
    const email = normalizeEmail(user.email);
    await this.db
      .insert(opsUsers)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        email,
        passwordHash: user.passwordHash,
        kind: user.kind,
      })
      .onConflictDoUpdate({
        target: opsUsers.id,
        set: {
          tenantId: user.tenantId,
          email,
          passwordHash: user.passwordHash,
          kind: user.kind,
          updatedAt: new Date(),
        },
      });
  }
}

function toOpsUser(row: typeof opsUsers.$inferSelect): OpsUser | null {
  if (row.passwordHash === null) {
    return null;
  }
  return {
    id: OpsUserId.parse(row.id),
    tenantId: OrganizationId.parse(row.tenantId),
    email: row.email,
    passwordHash: row.passwordHash,
    kind: row.kind,
  };
}
