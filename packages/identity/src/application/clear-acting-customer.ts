import type { IClock } from "../domain/clock.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import {
  resolveStaffActingSession,
  type ActingSessionFailureReason,
} from "./resolve-staff-acting-session.js";
import type { WholesaleStaffActingSession } from "./resolve-session.js";

export type ClearActingCustomerResult =
  | ({ ok: true } & WholesaleStaffActingSession)
  | { ok: false; reason: ActingSessionFailureReason };

export class ClearActingCustomerUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly clock: IClock,
  ) {}

  async execute(rawSessionId: string | null | undefined): Promise<ClearActingCustomerResult> {
    const resolved = await resolveStaffActingSession(
      this.sessions,
      this.staffUsers,
      this.clock,
      rawSessionId,
    );
    if (!resolved.ok) {
      return resolved;
    }
    await this.sessions.updateCustomerId(resolved.session.id, null);
    return {
      ok: true,
      mode: "staff_acting",
      staffUserId: resolved.staffUserId,
      wholesaleUserId: null,
      customerId: null,
      email: resolved.staffUser.email,
      organizationId: resolved.organizationId,
    };
  }
}
