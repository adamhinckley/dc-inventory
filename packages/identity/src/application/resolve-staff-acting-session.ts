import {
  InvalidIdError,
  SessionId,
  type OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { Session } from "../domain/session.js";
import { isSessionExpired } from "../domain/session.js";
import type { StaffUser } from "../domain/staff-user.js";
import type { SessionFailureReason } from "./resolve-session.js";

export type ActingSessionFailureReason = SessionFailureReason | "buyer_session";

export type ResolvedStaffActingSession = {
  session: Session;
  staffUser: StaffUser;
  staffUserId: StaffUserId;
  organizationId: OrganizationId;
};

export type ResolveStaffActingSessionResult =
  | { ok: true } & ResolvedStaffActingSession
  | { ok: false; reason: ActingSessionFailureReason };

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

export async function resolveStaffActingSession(
  sessions: ISessionStore,
  staffUsers: IStaffUserRepository,
  clock: IClock,
  rawSessionId: string | null | undefined,
): Promise<ResolveStaffActingSessionResult> {
  if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
    return { ok: false, reason: "missing" };
  }
  const sessionId = parseSessionId(rawSessionId);
  if (sessionId === null) {
    return { ok: false, reason: "invalid" };
  }
  const session = await sessions.findById(sessionId);
  if (session === null) {
    return { ok: false, reason: "invalid" };
  }
  if (session.audience !== "wholesale") {
    return { ok: false, reason: "wrong_audience" };
  }
  const now = clock.now();
  if (isSessionExpired(session, now)) {
    await sessions.delete(session.id);
    return { ok: false, reason: "expired" };
  }
  if (session.staffUserId === null || session.wholesaleUserId !== null) {
    return { ok: false, reason: "buyer_session" };
  }
  const staffUser = await staffUsers.findById(session.staffUserId);
  if (staffUser === null) {
    await sessions.delete(session.id);
    return { ok: false, reason: "invalid" };
  }
  if (staffUser.organizationId !== session.organizationId) {
    await sessions.delete(session.id);
    return { ok: false, reason: "invalid" };
  }
  await sessions.touch(session.id, now);
  return {
    ok: true,
    session,
    staffUser,
    staffUserId: session.staffUserId,
    organizationId: session.organizationId,
  };
}
