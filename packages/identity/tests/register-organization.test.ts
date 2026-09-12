import {
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryIdentityUnitOfWork } from "../src/adapters/in-memory-identity-unit-of-work.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { RegisterOrganizationUseCase } from "../src/application/register-organization.js";
import {
  TEST_BETA_ORG_NAME,
  TEST_STAFF_DISPLAY_NAME,
  testStaffUser,
} from "./support/fixtures.js";

const ACME_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");

function harness() {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const uow = new InMemoryIdentityUnitOfWork(undefined, staffUsers);
  return {
    passwords,
    staffUsers,
    uow,
    registerOrganization: new RegisterOrganizationUseCase(uow, passwords),
  };
}

const validRegistration = {
  name: TEST_BETA_ORG_NAME,
  staffDisplayName: TEST_STAFF_DISPLAY_NAME,
};

describe("RegisterOrganization (in-memory)", () => {
  it("creates a distinct Beta org and first staff without touching Acme DEFAULT data", async () => {
    const h = harness();
    await h.staffUsers.save(
      testStaffUser({
        id: ACME_STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "owner@acme.test",
        passwordHash: await h.passwords.hash("acme-secret"),
        roles: ["admin"],
      }),
    );

    const result = await h.registerOrganization.execute({
      slug: "beta-wholesale",
      ...validRegistration,
      staffEmail: "owner@beta.test",
      staffPassword: "Beta-secret1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.slug).toBe("beta-wholesale");
    expect(result.organizationId).not.toBe(OrganizationId.DEFAULT);
    expect(OrganizationId.parse(result.organizationId)).toBe(result.organizationId);

    const betaOrg = await h.uow.organizations.findBySlug("beta-wholesale");
    expect(betaOrg).toEqual({
      id: result.organizationId,
      slug: "beta-wholesale",
      name: TEST_BETA_ORG_NAME,
    });

    const betaStaff = await h.staffUsers.findByEmail(result.organizationId, "owner@beta.test");
    expect(betaStaff).not.toBeNull();
    if (betaStaff === null) {
      return;
    }
    expect(betaStaff.organizationId).toBe(result.organizationId);
    expect(betaStaff.id).toBe(result.staffUserId);

    const acmeStaff = await h.staffUsers.findByEmail(OrganizationId.DEFAULT, "owner@acme.test");
    expect(acmeStaff?.id).toBe(ACME_STAFF_ID);
  });

  it("allows the same email in DEFAULT and a new org", async () => {
    const h = harness();
    await h.staffUsers.save(
      testStaffUser({
        id: ACME_STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "shared@local.test",
        passwordHash: await h.passwords.hash("acme-secret"),
        roles: ["admin"],
      }),
    );

    const result = await h.registerOrganization.execute({
      slug: "beta",
      ...validRegistration,
      staffEmail: "shared@local.test",
      staffPassword: "Beta-secret1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const defaultUser = await h.staffUsers.findByEmail(
      OrganizationId.DEFAULT,
      "shared@local.test",
    );
    const betaUser = await h.staffUsers.findByEmail(result.organizationId, "shared@local.test");
    expect(defaultUser?.id).toBe(ACME_STAFF_ID);
    expect(betaUser?.id).not.toBe(ACME_STAFF_ID);
  });

  it("rejects duplicate slug", async () => {
    const h = harness();

    const first = await h.registerOrganization.execute({
      slug: "beta",
      ...validRegistration,
      staffEmail: "owner@beta.test",
      staffPassword: "Beta-secret1",
    });
    expect(first.ok).toBe(true);

    const duplicateSlug = await h.registerOrganization.execute({
      slug: "beta",
      ...validRegistration,
      staffEmail: "other@beta.test",
      staffPassword: "Other-secret1",
    });
    expect(duplicateSlug).toEqual({ ok: false, reason: "slug_taken" });
  });

  it("rejects invalid slug, email, password, org name, or staff display name", async () => {
    const h = harness();

    expect(
      await h.registerOrganization.execute({
        slug: "Bad Slug",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "secret",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "   ",
        staffPassword: "secret",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        name: " ",
        staffDisplayName: TEST_STAFF_DISPLAY_NAME,
        staffEmail: "owner@beta.test",
        staffPassword: "secret",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        name: TEST_BETA_ORG_NAME,
        staffDisplayName: " ",
        staffEmail: "owner@beta.test",
        staffPassword: "secret",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects passwords that violate the shared password policy", async () => {
    const h = harness();

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "short1A",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "beta-secret1",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "BETA-SECRET1",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "owner@beta.test",
        staffPassword: "Beta-secret",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
