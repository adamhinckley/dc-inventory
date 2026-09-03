import {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { InMemoryClock } from "../../src/adapters/in-memory-clock.js";
import { InMemoryOrganizationRepository } from "../../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../../src/adapters/in-memory-password-hasher.js";
import { InMemorySessionStore } from "../../src/adapters/in-memory-session-store.js";
import { InMemoryWholesaleUserRepository } from "../../src/adapters/in-memory-wholesale-user-repository.js";
import { LoginWholesaleUseCase } from "../../src/application/login-wholesale.js";
import { ResolveWholesaleSessionUseCase } from "../../src/application/resolve-session.js";
import type { WholesaleLoginAccountStatus } from "../../src/domain/account-status.js";
import type { IWholesaleLoginAccountStatusReadPort } from "../../src/domain/ports/wholesale-login-account-status-read.js";

export const DEFAULT_ORG = OrganizationId.DEFAULT;
export const ACME_SLUG = "acme";
export const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
export const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");

export type WholesaleLoginHarnessOptions = {
  /** Read at login time so tests can flip status between attempts. Defaults to active. */
  getAccountStatus?: () => WholesaleLoginAccountStatus | null;
  at?: Date;
};

export function wholesaleLoginHarness(options: WholesaleLoginHarnessOptions = {}) {
  const resolveAccountStatus = options.getAccountStatus ?? (() => "active" as WholesaleLoginAccountStatus);
  const clock = new InMemoryClock(options.at ?? new Date("2026-08-23T02:00:00.000Z"));
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();

  const wholesaleLoginAccountStatus: IWholesaleLoginAccountStatusReadPort = {
    getAccountStatus: async (organizationId, linkedPartyId) => {
      if (organizationId !== DEFAULT_ORG || linkedPartyId !== CUSTOMER_ID) {
        return null;
      }
      return resolveAccountStatus();
    },
  };

  const loginWholesale = new LoginWholesaleUseCase(
    organizations,
    wholesaleUsers,
    sessions,
    passwords,
    clock,
    wholesaleLoginAccountStatus,
  );

  return {
    clock,
    passwords,
    organizations,
    wholesaleUsers,
    sessions,
    wholesaleLoginAccountStatus,
    loginWholesale,
    resolveWholesale: new ResolveWholesaleSessionUseCase(sessions, wholesaleUsers, clock),
  };
}

export async function seedWholesaleLoginFixture(
  h: ReturnType<typeof wholesaleLoginHarness>,
) {
  await h.organizations.save({ id: DEFAULT_ORG, slug: ACME_SLUG });
  await h.wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: DEFAULT_ORG,
    email: "wholesale@local.test",
    passwordHash: await h.passwords.hash("wholesale-secret"),
    customerId: CUSTOMER_ID,
  });
}
