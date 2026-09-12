import {
  CreateCustomerUseCase,
  InMemoryCustomerRepository,
} from "@dc-inventory/customers";
import {
  CreateWholesaleUserUseCase,
  InMemoryEmailSender,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemoryWholesaleUserRepository,
  type IEmailSender,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  CreateCustomerWithWholesaleUserUseCase,
  STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS,
} from "./create-customer-with-wholesale-user.js";
import { RollbackCustomerStaffForThemUseCase } from "./rollback-customer-staff-for-them.js";

const ORG_ID = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

class FailingEmailSender implements IEmailSender {
  readonly sent: Parameters<IEmailSender["send"]>[0][] = [];

  async send(message: Parameters<IEmailSender["send"]>[0]): Promise<void> {
    this.sent.push(message);
    throw new Error("delivery failed");
  }
}

async function harness(emailSender: IEmailSender = new InMemoryEmailSender()) {
  const customers = new InMemoryCustomerRepository();
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: ORG_ID, slug: "acme", name: "Acme Wholesale" });
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const createCustomer = new CreateCustomerUseCase(customers);
  const createWholesaleUser = new CreateWholesaleUserUseCase(
    organizations,
    wholesaleUsers,
    passwords,
    emailSender,
    {
      buildSetPasswordUrl: async () =>
        "https://wholesale.test/set-password?token=orchestrator-test-token",
    },
  );
  const rollbackCustomerStaffForThem = new RollbackCustomerStaffForThemUseCase(
    customers,
    wholesaleUsers,
  );
  return {
    customers,
    emailSender,
    wholesaleUsers,
    useCase: new CreateCustomerWithWholesaleUserUseCase(
      createCustomer,
      createWholesaleUser,
      rollbackCustomerStaffForThem,
    ),
  };
}

describe("CreateCustomerWithWholesaleUserUseCase", () => {
  it("creates customer and wholesale user for admin with invite email", async () => {
    const h = await harness();

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "Harbor Supply",
      terms: "Net 30",
      wholesaleEmail: "buyer@harbor.test",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.customer.name).toBe("Harbor Supply");
    expect(result.customer.creditLimit.amountMinor).toBe(
      STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS,
    );

    const wholesale = await h.wholesaleUsers.findByEmail(ORG_ID, "buyer@harbor.test");
    expect(wholesale).not.toBeNull();
    expect(wholesale?.customerId).toBe(result.customer.id);
    expect(wholesale?.displayName).toBe("Harbor Supply");

    expect(h.emailSender.sent).toHaveLength(1);
    expect(h.emailSender.sent[0]?.text).toContain("/set-password?token=");
  });

  it("uses explicit wholesale display name when provided", async () => {
    const h = await harness();

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "Harbor Supply",
      terms: "Net 30",
      wholesaleEmail: "buyer@harbor.test",
      wholesaleDisplayName: "Pat Buyer",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const wholesale = await h.wholesaleUsers.findByEmail(ORG_ID, "buyer@harbor.test");
    expect(wholesale?.displayName).toBe("Pat Buyer");
  });

  it("rejects admin create without wholesale email", async () => {
    const h = await harness();

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "Harbor Supply",
      terms: "Net 30",
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("creates header only for purchasing", async () => {
    const h = await harness();

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["purchasing"],
      name: "Header Only Co",
      terms: "Net 30",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.customer.name).toBe("Header Only Co");
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("rejects wholesale login fields from non-admin roles", async () => {
    const h = await harness();

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["purchasing"],
      name: "Header Only Co",
      terms: "Net 30",
      wholesaleEmail: "buyer@harbor.test",
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(h.emailSender.sent).toHaveLength(0);
  });

  it("rolls back customer when wholesale email is duplicate", async () => {
    const h = await harness();

    const first = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "First Customer",
      terms: "Net 30",
      wholesaleEmail: "shared@harbor.test",
    });
    expect(first.ok).toBe(true);

    const duplicate = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "Second Customer",
      terms: "Net 30",
      wholesaleEmail: "shared@harbor.test",
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_email" });

    const listed = await h.customers.list({
      organizationId: ORG_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.name).toBe("First Customer");
  });

  it("rolls back customer and wholesale user when invite delivery fails", async () => {
    const failingEmail = new FailingEmailSender();
    const h = await harness(failingEmail);

    const result = await h.useCase.execute({
      organizationId: ORG_ID,
      staffUserId: STAFF_ID,
      staffRoles: ["admin"],
      name: "Invite Failed Co",
      terms: "Net 30",
      wholesaleEmail: "failed@harbor.test",
    });

    expect(result).toEqual({ ok: false, reason: "invite_failed" });
    expect(failingEmail.sent).toHaveLength(1);
    expect(await h.wholesaleUsers.findByEmail(ORG_ID, "failed@harbor.test")).toBeNull();
    const listed = await h.customers.list({
      organizationId: ORG_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(listed.items).toHaveLength(0);
  });
});
