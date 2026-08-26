import {
  CustomerId,
  OrganizationId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { ISessionStore, NewSession } from "../domain/ports/session-store.js";
import type { Session, SessionAudience } from "../domain/session.js";
import { sessions } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleSessionStore implements ISessionStore {
  constructor(private readonly db: IdentityDrizzle) {}

  async create(input: NewSession): Promise<Session> {
    const actorId =
      input.audience === "staff" ? input.staffUserId : input.wholesaleUserId;
    if (actorId === null) {
      throw new Error("session actor is required");
    }
    const [row] = await this.db
      .insert(sessions)
      .values({
        actorType: input.audience,
        actorId,
        organizationId: input.organizationId,
        customerId: input.customerId,
        lastSeenAt: input.lastSeenAt,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();
    if (row === undefined) {
      throw new Error("session insert returned no row");
    }
    return toSession(row);
  }

  async findById(id: SessionId): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toSession(rows[0]);
  }

  async touch(id: SessionId, lastSeenAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastSeenAt, updatedAt: lastSeenAt })
      .where(eq(sessions.id, id));
  }

  async delete(id: SessionId): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }
}

function toSession(row: typeof sessions.$inferSelect): Session {
  const audience = row.actorType as SessionAudience;
  return {
    id: SessionId.parse(row.id),
    audience,
    organizationId: OrganizationId.parse(row.organizationId),
    staffUserId: audience === "staff" ? StaffUserId.parse(row.actorId) : null,
    wholesaleUserId:
      audience === "wholesale" ? WholesaleUserId.parse(row.actorId) : null,
    customerId: row.customerId === null ? null : CustomerId.parse(row.customerId),
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}
