import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "../src/adapters/in-memory-email-sender.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { CreateStaffUserUseCase } from "../src/application/create-staff-user.js";
import {
  TEST_ORG_NAME,
  TEST_STAFF_DISPLAY_NAME,
  testOrganization,
  testStaffUser,
} from "./support/fixtures.js";

const EXISTING_STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440012");

function harness() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const emailSender = new InMemoryEmailSender();
  return {
    passwords,
    organizations,
    staffUsers,
    emailSender,
    createStaffUser: new CreateStaffUserUseCase(
      organizations,
      staffUsers,
      passwords,
      emailSender,
      {
        buildSetPasswordUrl: async () =>
          "https://internal.test/set-password?token=test-staff-token",
      },
    ),
  };
}

async function seedOrganization(h: ReturnType<typeof harness>) {
  await h.organizations.save(
    testOrganization({ id: OrganizationId.DEFAULT, slug: "acme", name: TEST_ORG_NAME }),
  );
}

describe("CreateStaffUser (in-memory)", () => {
  it("creates staff with roles and sends an invite email", async () => {
    const h = harness();
    await seedOrganization(h);

    const result = await h.createStaffUser.execute({
      organizationId: OrganizationId.DEFAULT,
      displayName: "Warehouse Lead",
      email: "warehouse.lead@local.test",
      roles: ["warehouse", "purchasing"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const saved = await h.staffUsers.findByEmail(
      OrganizationId.DEFAULT,
      "warehouse.lead@local.test",
    );
    expect(result.staffUser).toMatchObject({
      organizationId: OrganizationId.DEFAULT,
      displayName: "Warehouse Lead",
      email: "warehouse.lead@local.test",
      roles: ["warehouse", "purchasing"],
    });
    expect(saved).toMatchObject({
      id: result.staffUser.id,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Warehouse Lead",
      email: "warehouse.lead@local.test",
      roles: ["warehouse", "purchasing"],
    });
    expect(saved?.passwordHash).not.toBe("");

    expect(h.emailSender.sent).toHaveLength(1);
    expect(h.emailSender.sent[0]).toMatchObject({
      to: "warehouse.lead@local.test",
      subject: `You're invited to ${TEST_ORG_NAME}`,
    });
    expect(h.emailSender.sent[0]?.text).toContain("Warehouse Lead");
    expect(h.emailSender.sent[0]?.text).toContain("/set-password?token=");
  });

  it("rejects empty roles", async () => {
    const h = harness();
    await seedOrganization(h);

    const result = await h.createStaffUser.execute({
      organizationId: OrganizationId.DEFAULT,
      displayName: TEST_STAFF_DISPLAY_NAME,
      email: "empty.roles@local.test",
      roles: [],
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("rejects duplicate email in the same organization", async () => {
    const h = harness();
    await seedOrganization(h);
    await h.staffUsers.save(
      testStaffUser({
        id: EXISTING_STAFF_ID,
        organizationId: OrganizationId.DEFAULT,
        email: "existing@local.test",
        passwordHash: await h.passwords.hash("staff-secret"),
        roles: ["admin"],
      }),
    );

    const result = await h.createStaffUser.execute({
      organizationId: OrganizationId.DEFAULT,
      displayName: "Another Person",
      email: "existing@local.test",
      roles: ["warehouse"],
    });

    expect(result).toEqual({ ok: false, reason: "email_taken" });
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("rejects missing display name", async () => {
    const h = harness();
    await seedOrganization(h);

    const result = await h.createStaffUser.execute({
      organizationId: OrganizationId.DEFAULT,
      displayName: " ",
      email: "missing.name@local.test",
      roles: ["sales_support"],
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("rejects invalid email and unknown roles", async () => {
    const h = harness();
    await seedOrganization(h);

    expect(
      await h.createStaffUser.execute({
        organizationId: OrganizationId.DEFAULT,
        displayName: TEST_STAFF_DISPLAY_NAME,
        email: "   ",
        roles: ["warehouse"],
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.createStaffUser.execute({
        organizationId: OrganizationId.DEFAULT,
        displayName: TEST_STAFF_DISPLAY_NAME,
        email: "bad.role@local.test",
        roles: ["superuser"],
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
