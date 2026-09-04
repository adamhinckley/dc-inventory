import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { WholesaleLoginAccountStatus } from "../domain/account-status.js";
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

export type ActingCustomerPickerItem = {
  customerId: CustomerId;
  businessName: string;
  customerNumber: string;
  accountStatus: WholesaleLoginAccountStatus;
};

export type ListActingCustomersResult =
  | { ok: true; items: readonly ActingCustomerPickerItem[] }
  | { ok: false; reason: ActingSessionFailureReason };

export class ListActingCustomersUseCase {
  constructor(
    private readonly sessions: ISessionStore,
    private readonly staffUsers: IStaffUserRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly headerRead: IActingCustomerHeaderReadPort,
    private readonly accountStatus: IWholesaleLoginAccountStatusReadPort,
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
    const wholesaleCustomerIds = new Set(
      await this.wholesaleUsers.listCustomerIdsWithWholesaleUsers(resolved.organizationId),
    );
    const headers = await this.headerRead.list(resolved.organizationId);
    const items: ActingCustomerPickerItem[] = [];
    for (const header of headers) {
      if (!wholesaleCustomerIds.has(header.customerId)) {
        continue;
      }
      const status = await this.accountStatus.getAccountStatus(
        resolved.organizationId,
        header.customerId,
      );
      if (status === null || status === "inactive") {
        continue;
      }
      items.push({
        customerId: header.customerId,
        businessName: header.businessName,
        customerNumber: header.customerNumber,
        accountStatus: status,
      });
    }
    items.sort((a, b) => a.businessName.localeCompare(b.businessName));
    return { ok: true, items };
  }
}
