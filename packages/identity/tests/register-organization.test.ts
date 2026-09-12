import {
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "../src/adapters/in-memory-email-sender.js";
import type { EmailMessage, IEmailSender } from "../src/domain/ports/email-sender.js";
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

class FailingEmailSender implements IEmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push({ ...message });
    throw new Error("delivery failed");
  }
}

function harness(emailSender: InMemoryEmailSender | FailingEmailSender = new InMemoryEmailSender()) {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const uow = new InMemoryIdentityUnitOfWork(undefined, staffUsers);
  return {
    passwords,
    email: emailSender,
    staffUsers,
    uow,
    registerOrganization: new RegisterOrganizationUseCase(uow, passwords, emailSender, {
      buildSetPasswordUrl: ({ organizationSlug, staffUserId, staffEmail }) =>
        `https://internal.test/set-password?org=${organizationSlug}&user=${staffUserId}&email=${staffEmail}`,
    }),
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
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.slug).toBe("beta-wholesale");
    expect(result.inviteSentTo).toBe("owner@beta.test");
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
    expect(await h.passwords.verify("Beta-secret1", betaStaff.passwordHash)).toBe(false);

    const acmeStaff = await h.staffUsers.findByEmail(OrganizationId.DEFAULT, "owner@acme.test");
    expect(acmeStaff?.id).toBe(ACME_STAFF_ID);

    expect(h.email.sent).toHaveLength(1);
    expect(h.email.sent[0]).toMatchObject({
      to: "owner@beta.test",
      subject: `You're invited to ${TEST_BETA_ORG_NAME}`,
    });
    expect(h.email.sent[0]?.text).toContain("https://internal.test/set-password");
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
    });
    expect(first.ok).toBe(true);

    const duplicateSlug = await h.registerOrganization.execute({
      slug: "beta",
      ...validRegistration,
      staffEmail: "other@beta.test",
    });
    expect(duplicateSlug).toEqual({ ok: false, reason: "slug_taken" });
  });

  it("rolls back org and staff when invite delivery fails so slug can be retried", async () => {
    const h = harness(new FailingEmailSender());

    const failed = await h.registerOrganization.execute({
      slug: "harbor-wholesale",
      ...validRegistration,
      staffEmail: "owner@harbor.test",
    });
    expect(failed).toEqual({ ok: false, reason: "invite_failed" });
    expect(await h.uow.organizations.findBySlug("harbor-wholesale")).toBeNull();

    const working = harness();
    const retry = await working.registerOrganization.execute({
      slug: "harbor-wholesale",
      ...validRegistration,
      staffEmail: "owner@harbor.test",
    });
    expect(retry.ok).toBe(true);
  });

  it("rejects invalid slug, email, org name, or staff display name", async () => {
    const h = harness();

    expect(
      await h.registerOrganization.execute({
        slug: "Bad Slug",
        ...validRegistration,
        staffEmail: "owner@beta.test",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        ...validRegistration,
        staffEmail: "   ",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        name: " ",
        staffDisplayName: TEST_STAFF_DISPLAY_NAME,
        staffEmail: "owner@beta.test",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.registerOrganization.execute({
        slug: "beta",
        name: TEST_BETA_ORG_NAME,
        staffDisplayName: " ",
        staffEmail: "owner@beta.test",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
