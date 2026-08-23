import { InvalidIdError, SessionId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import { isSessionExpired, type SessionAudience } from "../domain/session.js";
import type { SessionFailureReason } from "./resolve-session.js";

export type LogoutResult = { ok: true } | { ok: false; reason: SessionFailureReason };

export class LogoutUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly clock: IClock,
    private readonly expected: SessionAudience,
  ) {}

  async execute(rawSessionId: string | null | undefined): Promise<LogoutResult> {
    if (rawSessionId === null || rawSessionId === undefined || rawSessionId.length === 0) {
      return { ok: false, reason: "missing" };
    }
    let sessionId: SessionId;
    try {
      sessionId = SessionId.parse(rawSessionId);
    } catch (error) {
      if (error instanceof InvalidIdError) {
        return { ok: false, reason: "invalid" };
      }
      throw error;
    }
    const session = await this.sessions.findById(sessionId);
    if (session === null) {
      return { ok: false, reason: "invalid" };
    }
    if (session.audience !== this.expected) {
      return { ok: false, reason: "wrong_audience" };
    }
    if (isSessionExpired(session, this.clock.now())) {
      await this.sessions.delete(session.id);
      return { ok: false, reason: "expired" };
    }
    await this.sessions.delete(session.id);
    return { ok: true };
  }
}
