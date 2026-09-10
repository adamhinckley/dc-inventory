import {
  CustomerId,
  OrganizationId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type {
  ISessionStore,
  NewSession,
  OpsResolvedSession,
  StaffResolvedSession,
  WholesaleBuyerResolvedSession,
  WholesaleStaffActingResolvedSession,
} from "../domain/ports/session-store.js";
import { OpsUserId } from "../domain/ops-user.js";
import type { Session, SessionAudience } from "../domain/session.js";
import { opsUsers, sessions, staffUsers, wholesaleUsers } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleSessionStore implements ISessionStore {
  constructor(private readonly db: IdentityDrizzle) {}

  async create(input: NewSession): Promise<Session> {
    const actorId =
      input.audience === "staff"
        ? input.staffUserId
        : input.audience === "wholesale"
          ? (input.wholesaleUserId ?? input.staffUserId)
          : input.opsUserId;
    if (actorId === null) {
      throw new Error("session actor is required");
    }
    const staffUserId =
      input.audience === "wholesale" && input.staffUserId !== null ? input.staffUserId : null;
    const [row] = await this.db
      .insert(sessions)
      .values({
        actorType: input.audience,
        actorId,
        staffUserId,
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

  async findStaffResolved(id: SessionId): Promise<StaffResolvedSession | null> {
    const rows = await this.db
      .select({
        session: sessions,
        email: staffUsers.email,
        roles: staffUsers.roles,
        organizationId: staffUsers.organizationId,
      })
      .from(sessions)
      .innerJoin(
        staffUsers,
        and(eq(sessions.actorType, "staff"), eq(sessions.actorId, staffUsers.id)),
      )
      .where(eq(sessions.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const session = toSession(row.session);
    if (session.audience !== "staff" || session.staffUserId === null) {
      return null;
    }
    if (OrganizationId.parse(row.organizationId) !== session.organizationId) {
      return null;
    }
    return {
      session,
      email: row.email,
      roles: row.roles,
    };
  }

  async findWholesaleStaffActingResolved(
    id: SessionId,
  ): Promise<WholesaleStaffActingResolvedSession | null> {
    const rows = await this.db
      .select({
        session: sessions,
        email: staffUsers.email,
        organizationId: staffUsers.organizationId,
      })
      .from(sessions)
      .innerJoin(staffUsers, eq(sessions.staffUserId, staffUsers.id))
      .where(and(eq(sessions.id, id), eq(sessions.actorType, "wholesale")))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const session = toSession(row.session);
    if (
      session.audience !== "wholesale" ||
      session.staffUserId === null ||
      session.wholesaleUserId !== null
    ) {
      return null;
    }
    if (OrganizationId.parse(row.organizationId) !== session.organizationId) {
      return null;
    }
    return {
      session,
      email: row.email,
    };
  }

  async findWholesaleBuyerResolved(
    id: SessionId,
  ): Promise<WholesaleBuyerResolvedSession | null> {
    const rows = await this.db
      .select({
        session: sessions,
        email: wholesaleUsers.email,
        organizationId: wholesaleUsers.organizationId,
      })
      .from(sessions)
      .innerJoin(
        wholesaleUsers,
        and(eq(sessions.actorType, "wholesale"), eq(sessions.actorId, wholesaleUsers.id)),
      )
      .where(eq(sessions.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const session = toSession(row.session);
    if (
      session.audience !== "wholesale" ||
      session.wholesaleUserId === null ||
      session.customerId === null
    ) {
      return null;
    }
    if (OrganizationId.parse(row.organizationId) !== session.organizationId) {
      return null;
    }
    return {
      session,
      email: row.email,
    };
  }

  async findOpsResolved(id: SessionId): Promise<OpsResolvedSession | null> {
    const rows = await this.db
      .select({
        session: sessions,
        email: opsUsers.email,
        kind: opsUsers.kind,
        tenantId: opsUsers.tenantId,
      })
      .from(sessions)
      .innerJoin(
        opsUsers,
        and(eq(sessions.actorType, "ops"), eq(sessions.actorId, opsUsers.id)),
      )
      .where(eq(sessions.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const session = toSession(row.session);
    if (session.audience !== "ops" || session.opsUserId === null) {
      return null;
    }
    return {
      session,
      email: row.email,
      kind: row.kind,
      tenantId: OrganizationId.parse(row.tenantId),
    };
  }

  async touch(id: SessionId, lastSeenAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastSeenAt, updatedAt: lastSeenAt })
      .where(eq(sessions.id, id));
  }

  async updateCustomerId(id: SessionId, customerId: CustomerId | null): Promise<void> {
    const now = new Date();
    await this.db
      .update(sessions)
      .set({ customerId, updatedAt: now })
      .where(eq(sessions.id, id));
  }

  async delete(id: SessionId): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }
}

function toSession(row: typeof sessions.$inferSelect): Session {
  const audience = row.actorType as SessionAudience;
  if (audience === "wholesale" && row.staffUserId !== null) {
    return {
      id: SessionId.parse(row.id),
      audience,
      organizationId: OrganizationId.parse(row.organizationId),
      staffUserId: StaffUserId.parse(row.staffUserId),
      wholesaleUserId: null,
      opsUserId: null,
      customerId: row.customerId === null ? null : CustomerId.parse(row.customerId),
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
    };
  }
  return {
    id: SessionId.parse(row.id),
    audience,
    organizationId: OrganizationId.parse(row.organizationId),
    staffUserId: audience === "staff" ? StaffUserId.parse(row.actorId) : null,
    wholesaleUserId:
      audience === "wholesale" ? WholesaleUserId.parse(row.actorId) : null,
    opsUserId: audience === "ops" ? OpsUserId.parse(row.actorId) : null,
    customerId: row.customerId === null ? null : CustomerId.parse(row.customerId),
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}
