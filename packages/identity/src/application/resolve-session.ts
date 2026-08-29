import {
  type CustomerId,
  InvalidIdError,
  type OrganizationId,
  SessionId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import { isSessionExpired } from "../domain/session.js";
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

export type ResolveWholesaleSessionResult =
  | {
      ok: true;
      wholesaleUserId: WholesaleUserId;
      email: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
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
    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== "staff" || session.staffUserId === null) {
      return { ok: false, reason: "wrong_audience" };
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
    await this.sessions.touch(session.id, now);
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
    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (
      session.audience !== "wholesale" ||
      session.wholesaleUserId === null ||
      session.customerId === null
    ) {
      return { ok: false, reason: "wrong_audience" };
    }
    const now = this.clock.now();
    if (isSessionExpired(session, now)) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
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
    await this.sessions.touch(session.id, now);
    return {
      ok: true,
      wholesaleUserId: session.wholesaleUserId,
      email: user.email,
      customerId: session.customerId,
      organizationId: session.organizationId,
    };
  }
}
