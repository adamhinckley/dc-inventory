import type { IClock } from "../domain/clock.js";
import type {
  ActingCustomerPickerRow,
  IActingCustomerHeaderReadPort,
} from "../domain/ports/acting-customer-header-read.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import {
  resolveStaffActingSession,
  type ActingSessionFailureReason,
} from "./resolve-staff-acting-session.js";

export type ActingCustomerPickerItem = ActingCustomerPickerRow;

export type ListActingCustomersResult =
  | { ok: true; items: readonly ActingCustomerPickerItem[] }
  | { ok: false; reason: ActingSessionFailureReason };

export class ListActingCustomersUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly headerRead: IActingCustomerHeaderReadPort,
    private readonly clock: IClock,
  ) {}

  async execute(rawSessionId: string | null | undefined): Promise<ListActingCustomersResult> {
    const resolved = await resolveStaffActingSession(
      this.sessions,
      this.staffUsers,
      this.clock,
      rawSessionId,
    );
    if (!resolved.ok) {
      return resolved;
    }
    const items = [...(await this.headerRead.listPickerItems(resolved.organizationId))];
    items.sort((a, b) => a.businessName.localeCompare(b.businessName));
    return { ok: true, items };
  }
}
