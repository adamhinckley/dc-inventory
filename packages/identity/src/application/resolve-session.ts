import {
  type CustomerId,
  InvalidIdError,
  type OrganizationId,
  SessionId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { OpsActorKind, OpsUserId } from "../domain/ops-user.js";
import type { IOpsUserRepository } from "../domain/ports/ops-user-repository.js";
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
      mode: "staff_acting";
      staffUserId: StaffUserId;
      wholesaleUserId: null;
      customerId: CustomerId | null;
      email: string;
      organizationId: OrganizationId;
    }
  | {
      ok: true;
      wholesaleUserId: WholesaleUserId;
      email: string;
      customerId: CustomerId;
      organizationId: OrganizationId;
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
        mode: "staff_acting",
        staffUserId: session.staffUserId,
        wholesaleUserId: null,
        customerId: session.customerId,
        email: user.email,
        organizationId: session.organizationId,
      };
    }
    if (session.wholesaleUserId === null || session.customerId === null) {
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
    await this.sessions.touch(session.id, now);
    return {
      ok: true,
      opsUserId: session.opsUserId,
      email: user.email,
      kind: user.kind,
      tenantId: user.tenantId,
    };
  }
}
