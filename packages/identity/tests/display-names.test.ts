import {
  CustomerId,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryIdentityUnitOfWork } from "../src/adapters/in-memory-identity-unit-of-work.js";
import { InMemoryOpsUserRepository } from "../src/adapters/in-memory-ops-user-repository.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { RegisterOrganizationUseCase } from "../src/application/register-organization.js";
import { OpsUserId } from "../src/domain/ops-user.js";
import { InvalidRequiredTextError } from "../src/domain/required-text.js";
import {
  TEST_BETA_ORG_NAME,
  TEST_ORG_NAME,
  TEST_STAFF_DISPLAY_NAME,
  testOrganization,
} from "./support/fixtures.js";

describe("Identity required display names", () => {
  it("rejects empty or whitespace organization names on save", async () => {
    const organizations = new InMemoryOrganizationRepository();
    await expect(
      organizations.save(testOrganization({ id: OrganizationId.DEFAULT, slug: "acme", name: "   " })),
    ).rejects.toThrow(InvalidRequiredTextError);
  });

  it("rejects undefined staff display names on save", async () => {
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();
    await expect(
      staffUsers.save({
        id: StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001"),
        organizationId: OrganizationId.DEFAULT,
        displayName: undefined as unknown as string,
        email: "staff@local.test",
        passwordHash: await passwords.hash("secret"),
        roles: ["admin"],
      }),
    ).rejects.toThrow(InvalidRequiredTextError);
  });

  it("rejects empty or whitespace staff display names on save", async () => {
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();
    await expect(
      staffUsers.save({
        id: StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001"),
        organizationId: OrganizationId.DEFAULT,
        displayName: " ",
        email: "staff@local.test",
        passwordHash: await passwords.hash("secret"),
        roles: ["admin"],
      }),
    ).rejects.toThrow(InvalidRequiredTextError);
  });

  it("rejects empty wholesale and ops display names on save", async () => {
    const passwords = new InMemoryPasswordHasher();
    const wholesaleUsers = new InMemoryWholesaleUserRepository();
    const opsUsers = new InMemoryOpsUserRepository();

    await expect(
      wholesaleUsers.save({
        id: WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002"),
        organizationId: OrganizationId.DEFAULT,
        displayName: "",
        email: "buyer@local.test",
        passwordHash: await passwords.hash("secret"),
        customerId: CustomerId.parse("550e8400-e29b-41d4-a716-446655440003"),
      }),
    ).rejects.toThrow(InvalidRequiredTextError);

    await expect(
      opsUsers.save({
        id: OpsUserId.parse("550e8400-e29b-41d4-a716-446655440005"),
        tenantId: OrganizationId.DEFAULT,
        displayName: "  ",
        email: "operator@local.test",
        passwordHash: await passwords.hash("secret"),
        kind: "operator",
      }),
    ).rejects.toThrow(InvalidRequiredTextError);
  });

  it("register organization rejects empty org name or staff display name", async () => {
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();
    const uow = new InMemoryIdentityUnitOfWork(undefined, staffUsers);
    const registerOrganization = new RegisterOrganizationUseCase(uow, passwords);

    expect(
      await registerOrganization.execute({
        slug: "beta",
        name: " ",
        staffEmail: "owner@beta.test",
        staffPassword: "beta-secret",
        staffDisplayName: TEST_STAFF_DISPLAY_NAME,
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await registerOrganization.execute({
        slug: "beta",
        name: TEST_BETA_ORG_NAME,
        staffEmail: "owner@beta.test",
        staffPassword: "beta-secret",
        staffDisplayName: " ",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("register organization persists non-empty org name and staff display name", async () => {
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();
    const uow = new InMemoryIdentityUnitOfWork(undefined, staffUsers);
    const registerOrganization = new RegisterOrganizationUseCase(uow, passwords);

    const result = await registerOrganization.execute({
      slug: "beta-wholesale",
      name: TEST_BETA_ORG_NAME,
      staffEmail: "owner@beta.test",
      staffPassword: "beta-secret",
      staffDisplayName: "Beta Owner",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const org = await uow.organizations.findBySlug("beta-wholesale");
    expect(org).toEqual({
      id: result.organizationId,
      slug: "beta-wholesale",
      name: TEST_BETA_ORG_NAME,
    });

    const staff = await staffUsers.findByEmail(result.organizationId, "owner@beta.test");
    expect(staff?.displayName).toBe("Beta Owner");
  });

  it("trims surrounding whitespace from saved organization and display names", async () => {
    const organizations = new InMemoryOrganizationRepository();
    const passwords = new InMemoryPasswordHasher();
    const staffUsers = new InMemoryStaffUserRepository();

    await organizations.save(
      testOrganization({
        id: OrganizationId.DEFAULT,
        slug: "acme",
        name: `  ${TEST_ORG_NAME}  `,
      }),
    );
    const org = await organizations.findBySlug("acme");
    expect(org?.name).toBe(TEST_ORG_NAME);

    await staffUsers.save({
      id: StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001"),
      organizationId: OrganizationId.DEFAULT,
      displayName: `  ${TEST_STAFF_DISPLAY_NAME}  `,
      email: "staff@local.test",
      passwordHash: await passwords.hash("secret"),
      roles: ["admin"],
    });
    const staff = await staffUsers.findById(StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001"));
    expect(staff?.displayName).toBe(TEST_STAFF_DISPLAY_NAME);
  });
});
