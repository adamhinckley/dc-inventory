import {
  CustomerId,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { ClearActingCustomerUseCase } from "../src/application/clear-acting-customer.js";
import { ListActingCustomersUseCase } from "../src/application/list-acting-customers.js";
import { SelectActingCustomerUseCase } from "../src/application/select-acting-customer.js";
import type { WholesaleLoginAccountStatus } from "../src/domain/account-status.js";
import type {
  ActingCustomerHeader,
  ActingCustomerPickerRow,
  IActingCustomerHeaderReadPort,
} from "../src/domain/ports/acting-customer-header-read.js";
import type { IWholesaleLoginAccountStatusReadPort } from "../src/domain/ports/wholesale-login-account-status-read.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
const ACTIVE_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");
const ON_HOLD_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440004");
const INACTIVE_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440005");
const NO_WHOLESALE_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440006");
const OTHER_ORG_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440007");
const OTHER_ORG_ID = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

class InMemoryActingCustomerHeaderReadPort implements IActingCustomerHeaderReadPort {
  constructor(
    private readonly headersByOrg: ReadonlyMap<OrganizationId, readonly ActingCustomerHeader[]>,
    private readonly wholesaleUsers: InMemoryWholesaleUserRepository,
    private readonly accountStatuses: ReadonlyMap<CustomerId, WholesaleLoginAccountStatus | null>,
  ) {}

  async listPickerItems(organizationId: OrganizationId): Promise<readonly ActingCustomerPickerRow[]> {
    const headers = this.headersByOrg.get(organizationId) ?? [];
    const wholesaleCustomerIds = new Set(
      await this.wholesaleUsers.listCustomerIdsWithWholesaleUsers(organizationId),
    );
    const items: ActingCustomerPickerRow[] = [];
    for (const header of headers) {
      if (!wholesaleCustomerIds.has(header.customerId)) {
        continue;
      }
      const status = this.accountStatuses.get(header.customerId) ?? null;
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
    return items;
  }

  async findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<ActingCustomerHeader | null> {
    const headers = this.headersByOrg.get(organizationId) ?? [];
    return headers.find((header) => header.customerId === customerId) ?? null;
  }
}

class ConfigurableAccountStatusReadPort implements IWholesaleLoginAccountStatusReadPort {
  constructor(
    private readonly statuses: ReadonlyMap<CustomerId, WholesaleLoginAccountStatus | null>,
  ) {}

  async getAccountStatus(
    _organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<WholesaleLoginAccountStatus | null> {
    return this.statuses.get(customerId) ?? null;
  }
}

const DEFAULT_HEADERS: readonly ActingCustomerHeader[] = [
  {
    customerId: ACTIVE_CUSTOMER_ID,
    businessName: "Active Wholesale",
    customerNumber: "C-00001",
  },
  {
    customerId: ON_HOLD_CUSTOMER_ID,
    businessName: "On Hold Wholesale",
    customerNumber: "C-00002",
  },
  {
    customerId: INACTIVE_CUSTOMER_ID,
    businessName: "Inactive Wholesale",
    customerNumber: "C-00003",
  },
  {
    customerId: NO_WHOLESALE_CUSTOMER_ID,
    businessName: "No Wholesale Login",
    customerNumber: "C-00004",
  },
];

const HEADERS_BY_ORG = new Map<OrganizationId, readonly ActingCustomerHeader[]>([
  [OrganizationId.DEFAULT, DEFAULT_HEADERS],
  [
    OTHER_ORG_ID,
    [
      {
        customerId: OTHER_ORG_CUSTOMER_ID,
        businessName: "Other Org Customer",
        customerNumber: "C-00005",
      },
    ],
  ],
]);

const ACCOUNT_STATUSES = new Map<CustomerId, WholesaleLoginAccountStatus | null>([
  [ACTIVE_CUSTOMER_ID, "active"],
  [ON_HOLD_CUSTOMER_ID, "on_hold"],
  [INACTIVE_CUSTOMER_ID, "inactive"],
  [NO_WHOLESALE_CUSTOMER_ID, "active"],
  [OTHER_ORG_CUSTOMER_ID, "active"],
]);

function harness(at = new Date("2026-08-23T02:00:00.000Z")) {
  const clock = new InMemoryClock(at);
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerHeaders = new InMemoryActingCustomerHeaderReadPort(
    HEADERS_BY_ORG,
    wholesaleUsers,
    ACCOUNT_STATUSES,
  );
  const accountStatus = new ConfigurableAccountStatusReadPort(ACCOUNT_STATUSES);
  return {
    clock,
    staffUsers,
    wholesaleUsers,
    sessions,
    customerHeaders,
    accountStatus,
    listActingCustomers: new ListActingCustomersUseCase(
      sessions,
      staffUsers,
      customerHeaders,
      clock,
    ),
    selectActingCustomer: new SelectActingCustomerUseCase(
      sessions,
      staffUsers,
      wholesaleUsers,
      customerHeaders,
      accountStatus,
      clock,
    ),
    clearActingCustomer: new ClearActingCustomerUseCase(sessions, staffUsers, clock),
  };
}

async function seedStaffActingSession(h: ReturnType<typeof harness>) {
  await h.staffUsers.save({
    id: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: "hash",
    roles: ["admin"],
  });
  await h.wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "buyer@local.test",
    passwordHash: "hash",
    customerId: ACTIVE_CUSTOMER_ID,
  });
  await h.wholesaleUsers.save({
    id: WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440008"),
    organizationId: OrganizationId.DEFAULT,
    email: "onhold@local.test",
    passwordHash: "hash",
    customerId: ON_HOLD_CUSTOMER_ID,
  });
  await h.wholesaleUsers.save({
    id: WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440009"),
    organizationId: OrganizationId.DEFAULT,
    email: "inactive@local.test",
    passwordHash: "hash",
    customerId: INACTIVE_CUSTOMER_ID,
  });
  const now = h.clock.now();
  return h.sessions.create({
    audience: "wholesale",
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    wholesaleUserId: null,
    opsUserId: null,
    customerId: null,
    createdAt: now,
    lastSeenAt: now,
  });
}

async function seedBuyerSession(h: ReturnType<typeof harness>) {
  const now = h.clock.now();
  return h.sessions.create({
    audience: "wholesale",
    organizationId: OrganizationId.DEFAULT,
    staffUserId: null,
    wholesaleUserId: WHOLESALE_ID,
    opsUserId: null,
    customerId: ACTIVE_CUSTOMER_ID,
    createdAt: now,
    lastSeenAt: now,
  });
}

describe("acting customer picker use cases", () => {
  it("lists active and on-hold customers with wholesale users, excluding inactive and no-login customers", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);

    const result = await h.listActingCustomers.execute(session.id);

    expect(result).toEqual({
      ok: true,
      items: [
        {
          customerId: ACTIVE_CUSTOMER_ID,
          businessName: "Active Wholesale",
          customerNumber: "C-00001",
          accountStatus: "active",
        },
        {
          customerId: ON_HOLD_CUSTOMER_ID,
          businessName: "On Hold Wholesale",
          customerNumber: "C-00002",
          accountStatus: "on_hold",
        },
      ],
    });
  });

  it("returns an empty list when no picker candidates exist", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      email: "staff@local.test",
      passwordHash: "hash",
      roles: ["admin"],
    });
    const now = h.clock.now();
    const session = await h.sessions.create({
      audience: "wholesale",
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });

    const result = await h.listActingCustomers.execute(session.id);

    expect(result).toEqual({ ok: true, items: [] });
  });

  it("rejects buyer sessions for list", async () => {
    const h = harness();
    const session = await seedBuyerSession(h);

    const result = await h.listActingCustomers.execute(session.id);

    expect(result).toEqual({ ok: false, reason: "buyer_session" });
  });

  it("selects an on-hold customer and persists customerId on the session", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);

    const result = await h.selectActingCustomer.execute(session.id, {
      customerId: ON_HOLD_CUSTOMER_ID,
    });

    expect(result).toEqual({
      ok: true,
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      customerId: ON_HOLD_CUSTOMER_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
    const stored = await h.sessions.findById(session.id);
    expect(stored?.customerId).toBe(ON_HOLD_CUSTOMER_ID);
  });

  it("overwrites a prior customer selection when selecting a different picker customer", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);

    const selectActive = await h.selectActingCustomer.execute(session.id, {
      customerId: ACTIVE_CUSTOMER_ID,
    });
    expect(selectActive).toEqual({
      ok: true,
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      customerId: ACTIVE_CUSTOMER_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
    let stored = await h.sessions.findById(session.id);
    expect(stored?.customerId).toBe(ACTIVE_CUSTOMER_ID);

    const selectOnHold = await h.selectActingCustomer.execute(session.id, {
      customerId: ON_HOLD_CUSTOMER_ID,
    });
    expect(selectOnHold).toEqual({
      ok: true,
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      customerId: ON_HOLD_CUSTOMER_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
    stored = await h.sessions.findById(session.id);
    expect(stored?.customerId).toBe(ON_HOLD_CUSTOMER_ID);
  });

  it("rejects inactive customers with inactive reason", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);

    const result = await h.selectActingCustomer.execute(session.id, {
      customerId: INACTIVE_CUSTOMER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("rejects customers without wholesale users and other-org customers as not_found", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);
    await h.wholesaleUsers.save({
      id: WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440010"),
      organizationId: OTHER_ORG_ID,
      email: "other@local.test",
      passwordHash: "hash",
      customerId: OTHER_ORG_CUSTOMER_ID,
    });

    const noWholesale = await h.selectActingCustomer.execute(session.id, {
      customerId: NO_WHOLESALE_CUSTOMER_ID,
    });
    const otherOrg = await h.selectActingCustomer.execute(session.id, {
      customerId: OTHER_ORG_CUSTOMER_ID,
    });
    const unknown = await h.selectActingCustomer.execute(session.id, {
      customerId: CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    });

    expect(noWholesale).toEqual({ ok: false, reason: "not_found" });
    expect(otherOrg).toEqual({ ok: false, reason: "not_found" });
    expect(unknown).toEqual({ ok: false, reason: "not_found" });
  });

  it("clears the selected customer from a staff-acting session", async () => {
    const h = harness();
    const session = await seedStaffActingSession(h);
    await h.selectActingCustomer.execute(session.id, {
      customerId: ACTIVE_CUSTOMER_ID,
    });

    const result = await h.clearActingCustomer.execute(session.id);

    expect(result).toEqual({
      ok: true,
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      customerId: null,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
    const stored = await h.sessions.findById(session.id);
    expect(stored?.customerId).toBeNull();
  });

  it("rejects buyer sessions for select and clear", async () => {
    const h = harness();
    const session = await seedBuyerSession(h);

    const select = await h.selectActingCustomer.execute(session.id, {
      customerId: ACTIVE_CUSTOMER_ID,
    });
    const clear = await h.clearActingCustomer.execute(session.id);

    expect(select).toEqual({ ok: false, reason: "buyer_session" });
    expect(clear).toEqual({ ok: false, reason: "buyer_session" });
  });
});
