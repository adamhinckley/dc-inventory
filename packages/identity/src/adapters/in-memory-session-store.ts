import { randomUUID } from "node:crypto";
import { CustomerId, SessionId, type StaffUserId, type WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { ISessionStore, NewSession } from "../domain/ports/session-store.js";
import type { Session } from "../domain/session.js";

export class InMemorySessionStore implements ISessionStore {
  private readonly byId = new Map<SessionId, Session>();

  async create(input: NewSession): Promise<Session> {
    const session: Session = {
      id: SessionId.parse(randomUUID()),
      ...input,
    };
    this.byId.set(session.id, session);
    return session;
  }

  async findById(id: SessionId): Promise<Session | null> {
    return this.byId.get(id) ?? null;
  }

  async touch(id: SessionId, lastSeenAt: Date): Promise<void> {
    const existing = this.byId.get(id);
    if (existing === undefined) {
      return;
    }
    this.byId.set(id, { ...existing, lastSeenAt });
  }

  async updateCustomerId(id: SessionId, customerId: CustomerId | null): Promise<void> {
    const existing = this.byId.get(id);
    if (existing === undefined) {
      return;
    }
    this.byId.set(id, { ...existing, customerId });
  }

  async delete(id: SessionId): Promise<void> {
    this.byId.delete(id);
  }

  async deleteByStaffUserId(staffUserId: StaffUserId): Promise<void> {
    for (const [id, session] of this.byId) {
      const matchesStaffUserColumn = session.staffUserId === staffUserId;
      const matchesStaffActor =
        session.audience === "staff" && session.staffUserId === staffUserId;
      if (matchesStaffUserColumn || matchesStaffActor) {
        this.byId.delete(id);
      }
    }
  }

  async deleteByWholesaleUserId(wholesaleUserId: WholesaleUserId): Promise<void> {
    for (const [id, session] of this.byId) {
      if (session.wholesaleUserId === wholesaleUserId) {
        this.byId.delete(id);
      }
    }
  }

  async deleteByCustomerId(customerId: CustomerId): Promise<void> {
    for (const [id, session] of this.byId) {
      if (session.customerId === customerId) {
        this.byId.delete(id);
      }
    }
  }
}
