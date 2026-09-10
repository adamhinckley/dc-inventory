import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import {
  CustomerId,
  Money,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { InMemoryDatabase } from "./in-memory-database.js";
import { createActingCustomerHeaderReadPort } from "./acting-customer-header-read-port.js";
import { composeAppServices } from "../infrastructure/composition.js";
import type { AppDrizzle } from "../infrastructure/db.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const ACTIVE_CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const ON_HOLD_CUSTOMER_ID = CustomerId.parse("44444444-4444-4444-8444-444444444444");
const INACTIVE_CUSTOMER_ID = CustomerId.parse("55555555-5555-4555-8555-555555555555");
const CREATED_AT = new Date("2026-08-24T03:30:00.000Z");

function customerIdForIndex(index: number): CustomerId {
  return CustomerId.parse(
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
}

function wholesaleUserIdForIndex(index: number): WholesaleUserId {
  return WholesaleUserId.parse(
    `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
}

async function seedManyCustomers(customerRepo: InMemoryCustomerRepository, total: number) {
  for (let index = 1; index <= total; index += 1) {
    await customerRepo.save({
      id: customerIdForIndex(index),
      organizationId: OrganizationId.DEFAULT,
      name: `Customer ${index}`,
      customerNumber: `C-${String(index).padStart(5, "0")}`,
      creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
      terms: "NET30",
      accountStatus: "active",
      createdAt: CREATED_AT,
    });
  }
}

async function seedWholesalePickerCustomers(customerRepo: InMemoryCustomerRepository) {
  await customerRepo.save({
    id: ACTIVE_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Active Wholesale",
    customerNumber: "C-90001",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "active",
    createdAt: CREATED_AT,
  });
  await customerRepo.save({
    id: ON_HOLD_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "On Hold Wholesale",
    customerNumber: "C-90002",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "on_hold",
    createdAt: CREATED_AT,
  });
  await customerRepo.save({
    id: INACTIVE_CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Inactive Wholesale",
    customerNumber: "C-90003",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    accountStatus: "inactive",
    createdAt: CREATED_AT,
  });
}

async function seedWholesaleUsers(wholesaleUsers: InMemoryWholesaleUserRepository) {
  await wholesaleUsers.save({
    id: wholesaleUserIdForIndex(1),
    organizationId: OrganizationId.DEFAULT,
    email: "active@local.test",
    passwordHash: "hash",
    customerId: ACTIVE_CUSTOMER_ID,
  });
  await wholesaleUsers.save({
    id: wholesaleUserIdForIndex(2),
    organizationId: OrganizationId.DEFAULT,
    email: "onhold@local.test",
    passwordHash: "hash",
    customerId: ON_HOLD_CUSTOMER_ID,
  });
  await wholesaleUsers.save({
    id: wholesaleUserIdForIndex(3),
    organizationId: OrganizationId.DEFAULT,
    email: "inactive@local.test",
    passwordHash: "hash",
    customerId: INACTIVE_CUSTOMER_ID,
  });
}

function mockSqlAppDb(rows: Array<{
  customerId: string;
  businessName: string;
  customerNumber: string;
  accountStatus: "active" | "on_hold";
}>): AppDrizzle {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  const selectDistinct = vi.fn().mockReturnValue({ from });
  return { selectDistinct } as unknown as AppDrizzle;
}

describe("createActingCustomerHeaderReadPort", () => {
  it("does not call customerRepo.list via composeAppServices when only a few wholesale accounts exist", async () => {
    const clock = new InMemoryClock(new Date("2026-08-23T02:00:00.000Z"));
    const customerRepo = new InMemoryCustomerRepository();
    const listSpy = vi.spyOn(customerRepo, "list");
    const wholesaleUsers = new InMemoryWholesaleUserRepository();
    const staffUsers = new InMemoryStaffUserRepository();
    const sessions = new InMemorySessionStore();

    await seedManyCustomers(customerRepo, 150);
    await seedWholesalePickerCustomers(customerRepo);
    await seedWholesaleUsers(wholesaleUsers);
    await staffUsers.save({
      id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      email: "staff@local.test",
      passwordHash: "hash",
      roles: ["admin"],
    });
    const now = clock.now();
    const session = await sessions.create({
      audience: "wholesale",
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      opsUserId: null,
      customerId: null,
      createdAt: now,
      lastSeenAt: now,
    });

    const services = composeAppServices({
      database: new InMemoryDatabase(),
      clock,
      customerRepo,
      wholesaleUsers,
      staffUsers,
      sessions,
    });
    const result = await services.identity.listActingCustomers.execute(session.id);

    expect(listSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      items: [
        {
          customerId: ACTIVE_CUSTOMER_ID,
          businessName: "Active Wholesale",
          customerNumber: "C-90001",
          accountStatus: "active",
        },
        {
          customerId: ON_HOLD_CUSTOMER_ID,
          businessName: "On Hold Wholesale",
          customerNumber: "C-90002",
          accountStatus: "on_hold",
        },
      ],
    });
  });

  it("uses the SQL join path without calling customerRepo.list", async () => {
    const customerRepo = new InMemoryCustomerRepository();
    const listSpy = vi.spyOn(customerRepo, "list");
    const wholesaleUsers = new InMemoryWholesaleUserRepository();
    const port = createActingCustomerHeaderReadPort(
      customerRepo,
      wholesaleUsers,
      mockSqlAppDb([
        {
          customerId: ACTIVE_CUSTOMER_ID,
          businessName: "Active Wholesale",
          customerNumber: "C-90001",
          accountStatus: "active",
        },
        {
          customerId: ON_HOLD_CUSTOMER_ID,
          businessName: "On Hold Wholesale",
          customerNumber: "C-90002",
          accountStatus: "on_hold",
        },
      ]),
    );

    const items = await port.listPickerItems(OrganizationId.DEFAULT);

    expect(listSpy).not.toHaveBeenCalled();
    expect(items).toEqual([
      {
        customerId: ACTIVE_CUSTOMER_ID,
        businessName: "Active Wholesale",
        customerNumber: "C-90001",
        accountStatus: "active",
      },
      {
        customerId: ON_HOLD_CUSTOMER_ID,
        businessName: "On Hold Wholesale",
        customerNumber: "C-90002",
        accountStatus: "on_hold",
      },
    ]);
  });
});
