import { CustomerId, SessionId, type StaffUserId, type WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { InMemoryOpsUserRepository } from "../src/adapters/in-memory-ops-user-repository.js";
import type { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import type { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import type { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import type {
  ISessionStore,
  NewSession,
  OpsResolvedSession,
  StaffResolvedSession,
  WholesaleResolvedSession,
} from "../src/domain/ports/session-store.js";
import type { Session } from "../src/domain/session.js";

export class JoinBackedSessionStore implements ISessionStore {
  constructor(
    private readonly sessions: InMemorySessionStore,
    private readonly staffUsers: InMemoryStaffUserRepository,
    private readonly wholesaleUsers: InMemoryWholesaleUserRepository,
    private readonly opsUsers: InMemoryOpsUserRepository,
  ) {}

  async create(input: NewSession): Promise<Session> {
    return this.sessions.create(input);
  }

  async findById(id: SessionId): Promise<Session | null> {
    return this.sessions.findById(id);
  }

  async touch(id: SessionId, lastSeenAt: Date): Promise<void> {
    return this.sessions.touch(id, lastSeenAt);
  }

  async updateCustomerId(id: SessionId, customerId: CustomerId | null): Promise<void> {
    return this.sessions.updateCustomerId(id, customerId);
  }

  async delete(id: SessionId): Promise<void> {
    return this.sessions.delete(id);
  }

  async deleteByStaffUserId(staffUserId: StaffUserId): Promise<void> {
    return this.sessions.deleteByStaffUserId(staffUserId);
  }

  async deleteByWholesaleUserId(wholesaleUserId: WholesaleUserId): Promise<void> {
    return this.sessions.deleteByWholesaleUserId(wholesaleUserId);
  }

  async deleteByCustomerId(customerId: CustomerId): Promise<void> {
    return this.sessions.deleteByCustomerId(customerId);
  }

  async findStaffResolved(id: SessionId): Promise<StaffResolvedSession | null> {
    const session = await this.sessions.findById(id);
    if (session === null || session.audience !== "staff" || session.staffUserId === null) {
      return null;
    }
    const user = await this.staffUsers.findById(session.staffUserId);
    if (user === null || user.organizationId !== session.organizationId) {
      return null;
    }
    return { session, email: user.email, displayName: user.displayName, roles: user.roles };
  }

  async findWholesaleResolved(id: SessionId): Promise<WholesaleResolvedSession | null> {
    const session = await this.sessions.findById(id);
    if (session === null || session.audience !== "wholesale") {
      return null;
    }
    if (session.staffUserId !== null && session.wholesaleUserId === null) {
      const user = await this.staffUsers.findById(session.staffUserId);
      if (user === null || user.organizationId !== session.organizationId) {
        return null;
      }
      return { mode: "staff_acting", session, email: user.email };
    }
    if (session.wholesaleUserId === null || session.customerId === null) {
      return null;
    }
    const user = await this.wholesaleUsers.findById(session.wholesaleUserId);
    if (user === null || user.organizationId !== session.organizationId) {
      return null;
    }
    return { mode: "buyer", session, email: user.email };
  }

  async findOpsResolved(id: SessionId): Promise<OpsResolvedSession | null> {
    const session = await this.sessions.findById(id);
    if (session === null || session.audience !== "ops" || session.opsUserId === null) {
      return null;
    }
    const user = await this.opsUsers.findById(session.opsUserId);
    if (user === null || user.tenantId !== session.organizationId) {
      return null;
    }
    return {
      session,
      email: user.email,
      kind: user.kind,
      tenantId: user.tenantId,
    };
  }
}
