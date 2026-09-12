import {
  CustomerId,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS } from "../src/adapters/active-wholesale-login-account-status.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { LoginWholesaleUseCase } from "../src/application/login-wholesale.js";
import { ResolveWholesaleSessionUseCase } from "../src/application/resolve-session.js";
import type { StaffRole } from "../src/domain/staff-role.js";

const ACME_SLUG = "acme";
const ADMIN_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const SALES_SUPPORT_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440012");
const PURCHASING_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440013");
const WAREHOUSE_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440014");
const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");

function harness(at = new Date("2026-08-23T02:00:00.000Z")) {
  const clock = new InMemoryClock(at);
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  return {
    clock,
    passwords,
    organizations,
    staffUsers,
    wholesaleUsers,
    sessions,
    loginWholesale: new LoginWholesaleUseCase(
      organizations,
      wholesaleUsers,
      staffUsers,
      sessions,
      passwords,
      clock,
      ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
    ),
    resolveWholesale: new ResolveWholesaleSessionUseCase(sessions, wholesaleUsers, staffUsers, clock),
  };
}

async function seedOrg(h: ReturnType<typeof harness>) {
  await h.organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG, name: "Acme Wholesale" });
}

async function seedStaffUser(
  h: ReturnType<typeof harness>,
  input: {
    id: StaffUserId;
    email: string;
    password: string;
    roles: readonly StaffRole[];
  },
) {
  await h.staffUsers.save({
    id: input.id,
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Staff",
    email: input.email,
    passwordHash: await h.passwords.hash(input.password),
    roles: input.roles,
  });
}

async function seedWholesaleBuyer(h: ReturnType<typeof harness>) {
  await h.wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Wholesale User",
    email: "buyer@local.test",
    passwordHash: await h.passwords.hash("buyer-secret"),
    customerId: CUSTOMER_ID,
  });
}

describe("Wholesale staff acting (ADA-268 owner tests)", () => {
  describe("LoginWholesaleUseCase", () => {
    it("creates a wholesale-audience session with staffUserId set and no buyer binding", async () => {
      const h = harness();
      await seedOrg(h);
      await seedStaffUser(h, {
        id: ADMIN_STAFF_ID,
        email: "david@local.test",
        password: "staff-secret",
        roles: ["admin"],
      });

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "david@local.test",
        password: "staff-secret",
      });

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) {
        return;
      }

      const stored = await h.sessions.findById(result.sessionId);
      expect(stored).toMatchObject({
        audience: "wholesale",
        organizationId: OrganizationId.DEFAULT,
        staffUserId: ADMIN_STAFF_ID,
        wholesaleUserId: null,
        customerId: null,
        opsUserId: null,
      });
    });

    it("still binds wholesaleUserId and customerId for an existing wholesale buyer", async () => {
      const h = harness();
      await seedOrg(h);
      await seedWholesaleBuyer(h);

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "buyer@local.test",
        password: "buyer-secret",
      });

      expect(result).toMatchObject({
        ok: true,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
        organizationId: OrganizationId.DEFAULT,
      });
      if (!result.ok) {
        return;
      }

      const stored = await h.sessions.findById(result.sessionId);
      expect(stored).toMatchObject({
        audience: "wholesale",
        staffUserId: null,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
      });
    });

    it.each([
      ["purchasing", PURCHASING_STAFF_ID, "purchasing@local.test"],
      ["warehouse", WAREHOUSE_STAFF_ID, "warehouse@local.test"],
    ] as const)(
      "rejects staff with only the %s role the same as a bad password",
      async (role, staffId, email) => {
        const h = harness();
        await seedOrg(h);
        await seedStaffUser(h, {
          id: staffId,
          email,
          password: "staff-secret",
          roles: [role],
        });

        const login = await h.loginWholesale.execute({
          organizationSlug: ACME_SLUG,
          email,
          password: "staff-secret",
        });
        const wrongPassword = await h.loginWholesale.execute({
          organizationSlug: ACME_SLUG,
          email,
          password: "nope",
        });

        expect(login).toEqual({ ok: false });
        expect(wrongPassword).toEqual({ ok: false });
      },
    );

    it.each([
      ["admin", ADMIN_STAFF_ID, "admin@local.test"],
      ["sales_support", SALES_SUPPORT_STAFF_ID, "sales@local.test"],
    ] as const)("allows staff wholesale login for the %s role", async (role, staffId, email) => {
      const h = harness();
      await seedOrg(h);
      await seedStaffUser(h, {
        id: staffId,
        email,
        password: "staff-secret",
        roles: [role],
      });

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email,
        password: "staff-secret",
      });

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) {
        return;
      }

      const stored = await h.sessions.findById(result.sessionId);
      expect(stored).toMatchObject({
        audience: "wholesale",
        staffUserId: staffId,
        wholesaleUserId: null,
        customerId: null,
      });
    });

    it("prefers an existing wholesale buyer over a staff user with the same email", async () => {
      const h = harness();
      await seedOrg(h);
      await seedWholesaleBuyer(h);
      await seedStaffUser(h, {
        id: ADMIN_STAFF_ID,
        email: "buyer@local.test",
        password: "buyer-secret",
        roles: ["admin"],
      });

      const result = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "buyer@local.test",
        password: "buyer-secret",
      });

      expect(result).toMatchObject({
        ok: true,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
      });
      if (!result.ok) {
        return;
      }

      const stored = await h.sessions.findById(result.sessionId);
      expect(stored).toMatchObject({
        audience: "wholesale",
        staffUserId: null,
        wholesaleUserId: WHOLESALE_ID,
        customerId: CUSTOMER_ID,
      });
    });
  });

  describe("ResolveWholesaleSessionUseCase", () => {
    it("resolves a staff-acting wholesale session without wrong_audience", async () => {
      const h = harness();
      await seedOrg(h);
      await seedStaffUser(h, {
        id: ADMIN_STAFF_ID,
        email: "david@local.test",
        password: "staff-secret",
        roles: ["admin"],
      });

      const now = h.clock.now();
      const session = await h.sessions.create({
        audience: "wholesale",
        organizationId: OrganizationId.DEFAULT,
        staffUserId: ADMIN_STAFF_ID,
        wholesaleUserId: null,
        opsUserId: null,
        customerId: null,
        createdAt: now,
        lastSeenAt: now,
      });

      const resolved = await h.resolveWholesale.execute(session.id);
      expect(resolved).toMatchObject({
        ok: true,
        mode: "staff_acting",
        staffUserId: ADMIN_STAFF_ID,
        wholesaleUserId: null,
        customerId: null,
        email: "david@local.test",
        organizationId: OrganizationId.DEFAULT,
      });
      expect(resolved).not.toEqual({ ok: false, reason: "wrong_audience" });
    });

    it("still resolves a wholesale buyer session as today", async () => {
      const h = harness();
      await seedOrg(h);
      await seedWholesaleBuyer(h);

      const login = await h.loginWholesale.execute({
        organizationSlug: ACME_SLUG,
        email: "buyer@local.test",
        password: "buyer-secret",
      });
      expect(login).toMatchObject({ ok: true });
      if (!login.ok) {
        return;
      }

      const resolved = await h.resolveWholesale.execute(login.sessionId);
      expect(resolved).toEqual({
        ok: true,
        wholesaleUserId: WHOLESALE_ID,
        email: "buyer@local.test",
        customerId: CUSTOMER_ID,
        organizationId: OrganizationId.DEFAULT,
      });
    });
  });
});
