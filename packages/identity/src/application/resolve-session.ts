import {
  type CustomerId,
  InvalidIdError,
  type OrganizationId,
  PlatformUserId,
  SessionId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { OpsActorKind, OpsUserId } from "../domain/ops-user.js";
import type { IPlatformUserRepository } from "../domain/ports/platform-user-repository.js";
import type { IOpsUserRepository } from "../domain/ports/ops-user-repository.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import type { Session, SessionAudience } from "../domain/session.js";
import { isSessionExpired, shouldTouchSessionLastSeen } from "../domain/session.js";
import type { StaffRole } from "../domain/staff-role.js";

export type SessionFailureReason =
  | "missing"
  | "invalid"
  | "expired"
  | "wrong_audience";

export type ResolveStaffSessionResult =
  | {
      ok: true;
      staffUserId: StaffUserId;
      email: string;
      organizationId: OrganizationId;
      roles: readonly StaffRole[];
    }
  | { ok: false; reason: SessionFailureReason };

export type WholesaleStaffActingSession = {
  mode: "staff_acting";
  staffUserId: StaffUserId;
  wholesaleUserId: null;
  customerId: CustomerId | null;
  email: string;
  organizationId: OrganizationId;
};

export type ResolveWholesaleSessionResult =
  | ({ ok: true } & WholesaleStaffActingSession)
  | {
      ok: true;
      wholesaleUserId: WholesaleUserId;
      email: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
    }
  | { ok: false; reason: SessionFailureReason };

export type ResolvePlatformSessionResult =
  | {
      ok: true;
      platformUserId: PlatformUserId;
      email: string;
    }
  | { ok: false; reason: SessionFailureReason };

export type ResolveOpsSessionResult =
  | {
      ok: true;
      opsUserId: OpsUserId;
      email: string;
      kind: OpsActorKind;
      tenantId: OrganizationId;
    }
  | { ok: false; reason: SessionFailureReason };

function parseSessionId(value: string): SessionId | null {
  try {
    return SessionId.parse(value);
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return null;
    }
    throw error;
  }
}

async function maybeTouchSession(
  sessions: ISessionStore,
  session: Session,
  now: Date,
): Promise<void> {
  if (shouldTouchSessionLastSeen(session, now)) {
    await sessions.touch(session.id, now);
  }
}

async function joinedSessionMissFailure(
  sessions: ISessionStore,
  sessionId: SessionId,
  expectedAudience: SessionAudience,
): Promise<SessionFailureReason> {
  const session = await sessions.findById(sessionId);
  if (session === null) {
    return "invalid";
  }
  if (session.audience !== expectedAudience) {
    return "wrong_audience";
  }
  await sessions.delete(session.id);
  return "invalid";
}

async function wholesaleJoinedSessionMissFailure(
  sessions: ISessionStore,
  sessionId: SessionId,
): Promise<SessionFailureReason> {
  const session = await sessions.findById(sessionId);
  if (session === null) {
    return "invalid";
  }
  if (session.audience !== "wholesale") {
    return "wrong_audience";
  }
  if (session.staffUserId !== null && session.wholesaleUserId === null) {
    await sessions.delete(session.id);
    return "invalid";
  }
  if (session.wholesaleUserId !== null) {
    await sessions.delete(session.id);
    return "invalid";
  }
  return "wrong_audience";
}

export class ResolveStaffSessionUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly clock: IClock,
  ) {}

  async execute(rawSessionId: string | null | undefined): Promise<ResolveStaffSessionResult> {
    if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
      return { ok: false, reason: "missing" };
    }
    const sessionId = parseSessionId(rawSessionId);
    if (sessionId === null) {
      return { ok: false, reason: "invalid" };
    }
    const findStaffResolved = this.sessions.findStaffResolved;
    if (findStaffResolved !== undefined) {
      const resolved = await findStaffResolved.call(this.sessions, sessionId);
      if (resolved === null) {
        return {
          ok: false,
          reason: await joinedSessionMissFailure(this.sessions, sessionId, "staff"),
        };
      }
      const { session, email, roles } = resolved;
      if (session.audience !== "staff" || session.staffUserId === null) {
        return { ok: false, reason: "wrong_audience" };
      }
      if (session.organizationId === null) {
        return { ok: false, reason: "invalid" };
      }
      const now = this.clock.now();
      if (isSessionExpired(session, now)) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "expired" };
      }
      await maybeTouchSession(this.sessions, session, now);
      return {
        ok: true,
        staffUserId: session.staffUserId,
        email,
        organizationId: session.organizationId,
        roles,
      };
    }

    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== "staff" || session.staffUserId === null) {
      return { ok: false, reason: "wrong_audience" };
    }
    if (session.organizationId === null) {
      return { ok: false, reason: "invalid" };
    }
    const now = this.clock.now();
    if (isSessionExpired(session, now)) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
    }
    const user = await this.staffUsers.findById(session.staffUserId);
    if (user === null) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    if (user.organizationId !== session.organizationId) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    await maybeTouchSession(this.sessions, session, now);
    return {
      ok: true,
      staffUserId: session.staffUserId,
      email: user.email,
      organizationId: session.organizationId,
      roles: user.roles,
    };
  }
}

export class ResolveWholesaleSessionUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly clock: IClock,
  ) {}

  async execute(
    rawSessionId: string | null | undefined,
  ): Promise<ResolveWholesaleSessionResult> {
    if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
      return { ok: false, reason: "missing" };
    }
    const sessionId = parseSessionId(rawSessionId);
    if (sessionId === null) {
      return { ok: false, reason: "invalid" };
    }

    const findWholesaleResolved = this.sessions.findWholesaleResolved;
    if (findWholesaleResolved !== undefined) {
      const resolved = await findWholesaleResolved.call(this.sessions, sessionId);
      if (resolved === null) {
        return {
          ok: false,
          reason: await wholesaleJoinedSessionMissFailure(this.sessions, sessionId),
        };
      }
      const { session, email, mode } = resolved;
      const now = this.clock.now();
      if (isSessionExpired(session, now)) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "expired" };
      }
      if (mode === "staff_acting") {
        const staffUserId = session.staffUserId;
        if (staffUserId === null || session.organizationId === null) {
          await this.sessions.delete(session.id);
          return { ok: false, reason: "invalid" };
        }
        await maybeTouchSession(this.sessions, session, now);
        return {
          ok: true,
          mode: "staff_acting",
          staffUserId,
          wholesaleUserId: null,
          customerId: session.customerId,
          email,
          organizationId: session.organizationId,
        };
      }
      const wholesaleUserId = session.wholesaleUserId;
      const customerId = session.customerId;
      if (
        wholesaleUserId === null ||
        customerId === null ||
        session.organizationId === null
      ) {
        return { ok: false, reason: "wrong_audience" };
      }
      await maybeTouchSession(this.sessions, session, now);
      return {
        ok: true,
        wholesaleUserId,
        email,
        customerId,
        organizationId: session.organizationId,
      };
    }

    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== "wholesale") {
      return { ok: false, reason: "wrong_audience" };
    }
    const now = this.clock.now();
    if (isSessionExpired(session, now)) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
    }
    if (session.staffUserId !== null && session.wholesaleUserId === null) {
      if (session.organizationId === null) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "invalid" };
      }
      const user = await this.staffUsers.findById(session.staffUserId);
      if (user === null) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "invalid" };
      }
      if (user.organizationId !== session.organizationId) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "invalid" };
      }
      await maybeTouchSession(this.sessions, session, now);
      return {
        ok: true,
        mode: "staff_acting",
        staffUserId: session.staffUserId,
        wholesaleUserId: null,
        customerId: session.customerId,
        email: user.email,
        organizationId: session.organizationId,
      };
    }
    if (
      session.wholesaleUserId === null ||
      session.customerId === null ||
      session.organizationId === null
    ) {
      return { ok: false, reason: "wrong_audience" };
    }
    const user = await this.wholesaleUsers.findById(session.wholesaleUserId);
    if (user === null) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    if (user.organizationId !== session.organizationId) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    await maybeTouchSession(this.sessions, session, now);
    return {
      ok: true,
      wholesaleUserId: session.wholesaleUserId,
      email: user.email,
      customerId: session.customerId,
      organizationId: session.organizationId,
    };
  }
}

export class ResolveOpsSessionUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly opsUsers: IOpsUserRepository,
    private readonly clock: IClock,
  ) {}

  async execute(rawSessionId: string | null | undefined): Promise<ResolveOpsSessionResult> {
    if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
      return { ok: false, reason: "missing" };
    }
    const sessionId = parseSessionId(rawSessionId);
    if (sessionId === null) {
      return { ok: false, reason: "invalid" };
    }
    const findOpsResolved = this.sessions.findOpsResolved;
    if (findOpsResolved !== undefined) {
      const resolved = await findOpsResolved.call(this.sessions, sessionId);
      if (resolved === null) {
        return {
          ok: false,
          reason: await joinedSessionMissFailure(this.sessions, sessionId, "ops"),
        };
      }
      const { session, email, kind, tenantId } = resolved;
      if (session.audience !== "ops" || session.opsUserId === null) {
        return { ok: false, reason: "wrong_audience" };
      }
      const now = this.clock.now();
      if (isSessionExpired(session, now)) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "expired" };
      }
      if (tenantId !== session.organizationId) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "invalid" };
      }
      await maybeTouchSession(this.sessions, session, now);
      return {
        ok: true,
        opsUserId: session.opsUserId,
        email,
        kind,
        tenantId,
      };
    }

    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== "ops" || session.opsUserId === null) {
      return { ok: false, reason: "wrong_audience" };
    }
    const now = this.clock.now();
    if (isSessionExpired(session, now)) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
    }
    const user = await this.opsUsers.findById(session.opsUserId);
    if (user === null || user.tenantId !== session.organizationId) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    await maybeTouchSession(this.sessions, session, now);
    return {
      ok: true,
      opsUserId: session.opsUserId,
      email: user.email,
      kind: user.kind,
      tenantId: user.tenantId,
    };
  }
}

export class ResolvePlatformSessionUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly platformUsers: IPlatformUserRepository,
    private readonly clock: IClock,
  ) {}

  async execute(
    rawSessionId: string | null | undefined,
  ): Promise<ResolvePlatformSessionResult> {
    if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
      return { ok: false, reason: "missing" };
    }
    const sessionId = parseSessionId(rawSessionId);
    if (sessionId === null) {
      return { ok: false, reason: "invalid" };
    }
    const findPlatformResolved = this.sessions.findPlatformResolved;
    if (findPlatformResolved !== undefined) {
      const resolved = await findPlatformResolved.call(this.sessions, sessionId);
      if (resolved === null) {
        return {
          ok: false,
          reason: await joinedSessionMissFailure(this.sessions, sessionId, "platform"),
        };
      }
      const { session, email } = resolved;
      if (session.audience !== "platform" || session.platformUserId === null) {
        return { ok: false, reason: "wrong_audience" };
      }
      if (session.organizationId !== null) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "invalid" };
      }
      const now = this.clock.now();
      if (isSessionExpired(session, now)) {
        await this.sessions.delete(session.id);
        return { ok: false, reason: "expired" };
      }
      await maybeTouchSession(this.sessions, session, now);
      return {
        ok: true,
        platformUserId: session.platformUserId,
        email,
      };
    }

    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== "platform" || session.platformUserId === null) {
      return { ok: false, reason: "wrong_audience" };
    }
    if (session.organizationId !== null) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    const now = this.clock.now();
    if (isSessionExpired(session, now)) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
    }
    const user = await this.platformUsers.findById(session.platformUserId);
    if (user === null) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "invalid" };
    }
    await maybeTouchSession(this.sessions, session, now);
    return {
      ok: true,
      platformUserId: session.platformUserId,
      email: user.email,
    };
  }
}
