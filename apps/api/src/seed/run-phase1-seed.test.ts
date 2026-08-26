import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryContactRepository,
  InMemoryCustomerRepository,
} from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LoginStaffUseCase,
  LoginWholesaleUseCase,
} from "@dc-inventory/identity";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_PRODUCT_SKUS,
  PHASE1_PRODUCTS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import { Phase1SeedError, runPhase1Seed } from "./run-phase1-seed.js";

function seedPorts() {
  return {
    products: new InMemoryProductRepository(),
    customers: new InMemoryCustomerRepository(),
    staffUsers: new InMemoryStaffUserRepository(),
    wholesaleUsers: new InMemoryWholesaleUserRepository(),
    passwords: new InMemoryPasswordHasher(),
  };
}

describe("Phase 1 seed (in-memory)", () => {
  it("upserts Acme, local users, and the five shop-visible SKUs", async () => {
    const ports = seedPorts();
    const contacts = new InMemoryContactRepository();
    const sessions = new InMemorySessionStore();

    const first = await runPhase1Seed(ports, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    expect(first.customer.name).toBe(PHASE1_CUSTOMER_NAME);
    expect(first.customer.terms).toBe(PHASE1_CUSTOMER_TERMS);
    expect(first.customer.creditLimit.amountMinor).toBe(
      PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
    );
    expect(first.customer.creditLimit.currency).toBe(PHASE1_CUSTOMER_CURRENCY);
    expect(first.staff.email).toBe(PHASE1_STAFF_EMAIL);
    expect(first.wholesale.email).toBe(PHASE1_WHOLESALE_EMAIL);
    expect(first.wholesale.customerId).toBe(first.customer.id);
    expect(first.products.map((row) => row.sku.value)).toEqual([...PHASE1_PRODUCT_SKUS]);
    expect(PHASE1_PRODUCTS).toHaveLength(5);
    for (const product of first.products) {
      expect(product.webWholesale).toBe(true);
      expect(product.inactive).toBe(false);
      expect(product.discontinued).toBe(false);
      expect(Number.isInteger(product.memberPrice.amountMinor)).toBe(true);
      expect(product.memberPrice.currency).toBe("USD");
    }

    expect(await contacts.listByCustomer(first.customer.id)).toEqual([]);

    const listed = await ports.products.listMatching({ organizationId: OrganizationId.DEFAULT });
    expect(listed).toHaveLength(5);

    const second = await runPhase1Seed(ports, {
      staffPassword: "staff-placeholder-rotated",
      wholesalePassword: "wholesale-placeholder-rotated",
    });
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.staff.id).toBe(first.staff.id);
    expect(second.wholesale.id).toBe(first.wholesale.id);
    expect(second.products.map((row) => row.id)).toEqual(first.products.map((row) => row.id));
    expect(await ports.products.listMatching({ organizationId: OrganizationId.DEFAULT })).toHaveLength(5);
    expect(await ports.customers.findByName(PHASE1_CUSTOMER_NAME)).toEqual(second.customer);

    const clock = new InMemoryClock(new Date("2026-08-23T04:00:00.000Z"));
    const staffLogin = await new LoginStaffUseCase(
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({
      email: PHASE1_STAFF_EMAIL,
      password: "staff-placeholder-rotated",
    });
    expect(staffLogin.ok).toBe(true);

    const wholesaleLogin = await new LoginWholesaleUseCase(
      ports.wholesaleUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({
      email: PHASE1_WHOLESALE_EMAIL,
      password: "wholesale-placeholder-rotated",
    });
    expect(wholesaleLogin.ok).toBe(true);
    if (wholesaleLogin.ok) {
      expect(wholesaleLogin.customerId).toBe(first.customer.id);
    }
  });

  it("rejects empty passwords and does not invent a sixth SKU", async () => {
    const ports = seedPorts();
    await expect(
      runPhase1Seed(ports, { staffPassword: "   ", wholesalePassword: "ok" }),
    ).rejects.toBeInstanceOf(Phase1SeedError);
    expect(PHASE1_PRODUCT_SKUS).not.toContain("INTERNAL-ONLY");
    expect(new Set(PHASE1_PRODUCT_SKUS).size).toBe(5);
  });
});
