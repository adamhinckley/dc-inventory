import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryContactRepository,
  InMemoryCustomerRepository,
} from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemoryPlatformUserRepository,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LoginPlatformUseCase,
  LoginStaffUseCase,
  LoginWholesaleUseCase,
  ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_ORGANIZATION_SLUG,
  PHASE1_PLATFORM_EMAIL,
  PHASE1_PRODUCT_SKUS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import { Phase1SeedError, runPhase1Seed } from "./run-phase1-seed.js";

function seedPorts() {
  return {
    customers: new InMemoryCustomerRepository(),
    organizations: new InMemoryOrganizationRepository(),
    platformUsers: new InMemoryPlatformUserRepository(),
    staffUsers: new InMemoryStaffUserRepository(),
    wholesaleUsers: new InMemoryWholesaleUserRepository(),
    passwords: new InMemoryPasswordHasher(),
  };
}

describe("Phase 1 seed (in-memory)", () => {
  it("upserts Acme and local users without catalog SKUs", async () => {
    const ports = seedPorts();
    const contacts = new InMemoryContactRepository();
    const sessions = new InMemorySessionStore();
    const products = new InMemoryProductRepository();

    const first = await runPhase1Seed(ports, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
      platformPassword: "platform-placeholder",
    });

    expect(first.customer.name).toBe(PHASE1_CUSTOMER_NAME);
    expect(first.customer.terms).toBe(PHASE1_CUSTOMER_TERMS);
    expect(first.customer.creditLimit.amountMinor).toBe(
      PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
    );
    expect(first.customer.creditLimit.currency).toBe(PHASE1_CUSTOMER_CURRENCY);
    expect(first.staff.email).toBe(PHASE1_STAFF_EMAIL);
    expect(first.platform.email).toBe(PHASE1_PLATFORM_EMAIL);
    expect(first.wholesale.email).toBe(PHASE1_WHOLESALE_EMAIL);
    expect(first.wholesale.customerId).toBe(first.customer.id);

    expect(await contacts.listByCustomer(first.customer.id)).toEqual([]);
    expect(await products.listMatching({ organizationId: OrganizationId.DEFAULT })).toEqual([]);

    const second = await runPhase1Seed(ports, {
      staffPassword: "staff-placeholder-rotated",
      wholesalePassword: "wholesale-placeholder-rotated",
      platformPassword: "platform-placeholder-rotated",
    });
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.platform.id).toBe(first.platform.id);
    expect(second.staff.id).toBe(first.staff.id);
    expect(second.wholesale.id).toBe(first.wholesale.id);
    expect(await ports.customers.findByName(OrganizationId.DEFAULT, PHASE1_CUSTOMER_NAME)).toEqual(second.customer);

    const clock = new InMemoryClock(new Date("2026-08-23T04:00:00.000Z"));
    const staffLogin = await new LoginStaffUseCase(
      ports.organizations,
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: PHASE1_STAFF_EMAIL,
      password: "staff-placeholder-rotated",
    });
    expect(staffLogin.ok).toBe(true);

    const platformLogin = await new LoginPlatformUseCase(
      ports.platformUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({
      email: PHASE1_PLATFORM_EMAIL,
      password: "platform-placeholder-rotated",
    });
    expect(platformLogin.ok).toBe(true);

    const wholesaleLogin = await new LoginWholesaleUseCase(
      ports.organizations,
      ports.wholesaleUsers,
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
      ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
    ).execute({
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: PHASE1_WHOLESALE_EMAIL,
      password: "wholesale-placeholder-rotated",
    });
    expect(wholesaleLogin.ok).toBe(true);
    if (wholesaleLogin.ok) {
      expect(wholesaleLogin.customerId).toBe(first.customer.id);
    }
  });

  it("upgrades existing demo staff roles to include accounting", async () => {
    const ports = seedPorts();
    await ports.organizations.save({ id: OrganizationId.DEFAULT, slug: PHASE1_ORGANIZATION_SLUG, name: "Acme Wholesale" });
    await ports.staffUsers.save({
      id: StaffUserId.parse("11111111-1111-4111-8111-111111111111"),
      organizationId: OrganizationId.DEFAULT,
      displayName: "Demo Staff",
      email: PHASE1_STAFF_EMAIL,
      passwordHash: await ports.passwords.hash("staff-placeholder"),
      roles: ["admin"],
    });

    const seeded = await runPhase1Seed(ports, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
      platformPassword: "platform-placeholder",
    });

    expect(seeded.staff.roles).toEqual(["admin", "accounting"]);
  });

  it("rejects empty passwords and does not invent a sixth SKU", async () => {
    const ports = seedPorts();
    await expect(
      runPhase1Seed(ports, {
        staffPassword: "   ",
        wholesalePassword: "ok",
        platformPassword: "ok",
      }),
    ).rejects.toBeInstanceOf(Phase1SeedError);
    expect(PHASE1_PRODUCT_SKUS).not.toContain("INTERNAL-ONLY");
    expect(new Set(PHASE1_PRODUCT_SKUS).size).toBe(5);
  });
});
