import { randomUUID } from "node:crypto";
import { CustomerId, SessionId } from "@dc-inventory/shared-kernel";
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
}
