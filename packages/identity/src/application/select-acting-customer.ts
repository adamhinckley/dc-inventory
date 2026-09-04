import { CustomerId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { IActingCustomerHeaderReadPort } from "../domain/ports/acting-customer-header-read.js";
import type { ISessionStore } from "../domain/ports/session-store.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import type { IWholesaleLoginAccountStatusReadPort } from "../domain/ports/wholesale-login-account-status-read.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import {
  resolveStaffActingSession,
  type ActingSessionFailureReason,
} from "./resolve-staff-acting-session.js";

export type SelectActingCustomerRequest = {
  customerId: string;
};

export type SelectActingCustomerResult =
  | { ok: true; customerId: CustomerId }
  | { ok: false; reason: ActingSessionFailureReason }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "inactive" };

export class SelectActingCustomerUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly headerRead: IActingCustomerHeaderReadPort,
    private readonly accountStatus: IWholesaleLoginAccountStatusReadPort,
    private readonly clock: IClock,
  ) {}

  async execute(
    rawSessionId: string | null | undefined,
    input: SelectActingCustomerRequest,
  ): Promise<SelectActingCustomerResult> {
    const resolved = await resolveStaffActingSession(
      this.sessions,
      this.staffUsers,
      this.clock,
      rawSessionId,
    );
    if (!resolved.ok) {
      return resolved;
    }
    let customerId: CustomerId;
    try {
      customerId = CustomerId.parse(input.customerId);
    } catch {
      return { ok: false, reason: "not_found" };
    }
    const header = await this.headerRead.findById(resolved.organizationId, customerId);
    if (header === null) {
      return { ok: false, reason: "not_found" };
    }
    const wholesaleCustomerIds = new Set(
      await this.wholesaleUsers.listCustomerIdsWithWholesaleUsers(resolved.organizationId),
    );
    if (!wholesaleCustomerIds.has(customerId)) {
      return { ok: false, reason: "not_found" };
    }
    const status = await this.accountStatus.getAccountStatus(
      resolved.organizationId,
      customerId,
    );
    if (status === null) {
      return { ok: false, reason: "not_found" };
    }
    if (status === "inactive") {
      return { ok: false, reason: "inactive" };
    }
    await this.sessions.updateCustomerId(resolved.session.id, customerId);
    return { ok: true, customerId };
  }
}
