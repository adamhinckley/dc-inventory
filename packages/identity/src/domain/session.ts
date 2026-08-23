import type { CustomerId, SessionId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type SessionAudience = "staff" | "wholesale";

export type Session = {
  id: SessionId;
  audience: SessionAudience;
  staffUserId: StaffUserId | null;
  wholesaleUserId: WholesaleUserId | null;
  customerId: CustomerId | null;
  createdAt: Date;
  lastSeenAt: Date;
};

export function isSessionExpired(session: Session, now: Date): boolean {
  const idle = now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS;
  const absolute = now.getTime() - session.createdAt.getTime() > SESSION_ABSOLUTE_MS;
  return idle || absolute;
}
