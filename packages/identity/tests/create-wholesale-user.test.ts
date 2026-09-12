import {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "../src/adapters/in-memory-email-sender.js";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { CreateWholesaleUserUseCase } from "../src/application/create-wholesale-user.js";
import {
  TEST_ORG_NAME,
  TEST_WHOLESALE_DISPLAY_NAME,
  testOrganization,
  testWholesaleUser,
} from "./support/fixtures.js";

const ORG_ID = OrganizationId.DEFAULT;
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");
const OTHER_CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440004");
const EXISTING_USER_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");

function harness() {
  const passwords = new InMemoryPasswordHasher();
  const email = new InMemoryEmailSender();
  const organizations = new InMemoryOrganizationRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  return {
    passwords,
    email,
    organizations,
    wholesaleUsers,
    createWholesaleUser: new CreateWholesaleUserUseCase(
      organizations,
      wholesaleUsers,
      passwords,
      email,
      {
        buildSetPasswordUrl: async () =>
          "https://wholesale.test/set-password?token=test-wholesale-token",
      },
    ),
  };
}

async function seedOrganization(h: ReturnType<typeof harness>) {
  await h.organizations.save(
    testOrganization({ id: ORG_ID, slug: "acme", name: TEST_ORG_NAME }),
  );
}

describe("CreateWholesaleUser (in-memory)", () => {
  it("binds customerId and sends invite email", async () => {
    const h = harness();
    await seedOrganization(h);

    const result = await h.createWholesaleUser.execute({
      organizationId: ORG_ID,
      customerId: CUSTOMER_ID,
      email: "buyer@local.test",
      displayName: "Harbor Buyer",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.inviteSentTo).toBe("buyer@local.test");

    const saved = await h.wholesaleUsers.findById(result.wholesaleUserId);
    expect(saved).not.toBeNull();
    if (saved === null) {
      return;
    }
    expect(saved).toMatchObject({
      id: result.wholesaleUserId,
      organizationId: ORG_ID,
      displayName: "Harbor Buyer",
      email: "buyer@local.test",
      customerId: CUSTOMER_ID,
    });
    expect(saved.passwordHash.length).toBeGreaterThan(0);
    expect(await h.passwords.verify("buyer-secret", saved.passwordHash)).toBe(false);

    expect(h.email.sent).toHaveLength(1);
    expect(h.email.sent[0]).toMatchObject({
      to: "buyer@local.test",
      subject: `You're invited to ${TEST_ORG_NAME} wholesale`,
    });
    expect(h.email.sent[0]?.text).toContain("/set-password?token=");
    expect(h.email.sent[0]?.text).toContain("Harbor Buyer");
  });

  it("rejects duplicate email in the same organization", async () => {
    const h = harness();
    await seedOrganization(h);
    await h.wholesaleUsers.save(
      testWholesaleUser({
        id: EXISTING_USER_ID,
        organizationId: ORG_ID,
        email: "buyer@local.test",
        customerId: CUSTOMER_ID,
        passwordHash: await h.passwords.hash("existing-secret"),
      }),
    );

    const result = await h.createWholesaleUser.execute({
      organizationId: ORG_ID,
      customerId: OTHER_CUSTOMER_ID,
      email: "buyer@local.test",
      displayName: TEST_WHOLESALE_DISPLAY_NAME,
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_email" });
    expect(h.email.sent).toHaveLength(0);
  });

  it("allows the same email in a different organization", async () => {
    const h = harness();
    const betaOrgId = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
    await h.organizations.save(
      testOrganization({ id: ORG_ID, slug: "acme", name: TEST_ORG_NAME }),
    );
    await h.organizations.save(
      testOrganization({ id: betaOrgId, slug: "beta", name: "Beta Wholesale" }),
    );
    await h.wholesaleUsers.save(
      testWholesaleUser({
        id: EXISTING_USER_ID,
        organizationId: ORG_ID,
        email: "shared@local.test",
        customerId: CUSTOMER_ID,
        passwordHash: await h.passwords.hash("existing-secret"),
      }),
    );

    const result = await h.createWholesaleUser.execute({
      organizationId: betaOrgId,
      customerId: OTHER_CUSTOMER_ID,
      email: "shared@local.test",
      displayName: TEST_WHOLESALE_DISPLAY_NAME,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.wholesaleUserId).not.toBe(EXISTING_USER_ID);
    expect(h.email.sent).toHaveLength(1);
  });

  it("rejects empty or whitespace display names", async () => {
    const h = harness();
    await seedOrganization(h);

    expect(
      await h.createWholesaleUser.execute({
        organizationId: ORG_ID,
        customerId: CUSTOMER_ID,
        email: "buyer@local.test",
        displayName: " ",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.createWholesaleUser.execute({
        organizationId: ORG_ID,
        customerId: CUSTOMER_ID,
        email: "buyer@local.test",
        displayName: "",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(h.email.sent).toHaveLength(0);
  });

  it("rejects invalid email or unknown organization", async () => {
    const h = harness();

    expect(
      await h.createWholesaleUser.execute({
        organizationId: ORG_ID,
        customerId: CUSTOMER_ID,
        email: "   ",
        displayName: TEST_WHOLESALE_DISPLAY_NAME,
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    expect(
      await h.createWholesaleUser.execute({
        organizationId: ORG_ID,
        customerId: CUSTOMER_ID,
        email: "buyer@local.test",
        displayName: TEST_WHOLESALE_DISPLAY_NAME,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
