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
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { CreateCustomerWithWholesaleUserUseCase } from "./create-customer-with-wholesale-user.js";

const ORG_ID = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

async function harness() {
  const customers = new InMemoryCustomerRepository();
  const passwords = new InMemoryPasswordHasher();
  const email = new InMemoryEmailSender();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: ORG_ID, slug: "acme", name: "Acme Wholesale" });
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const createCustomer = new CreateCustomerUseCase(customers);
  const createWholesaleUser = new CreateWholesaleUserUseCase(
    organizations,
    wholesaleUsers,
    passwords,
    email,
    {
      buildSetPasswordUrl: async () =>
        "https://wholesale.test/set-password?token=orchestrator-test-token",
    },
  );
  return {
    customers,
    email,
    wholesaleUsers,
    useCase: new CreateCustomerWithWholesaleUserUseCase(createCustomer, createWholesaleUser),
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

    const wholesale = await h.wholesaleUsers.findByEmail(ORG_ID, "buyer@harbor.test");
    expect(wholesale).not.toBeNull();
    expect(wholesale?.customerId).toBe(result.customer.id);
    expect(wholesale?.displayName).toBe("Harbor Supply");

    expect(h.email.sent).toHaveLength(1);
    expect(h.email.sent[0]?.text).toContain("/set-password?token=");
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
    expect(h.email.sent).toHaveLength(0);
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
    expect(h.email.sent).toHaveLength(0);
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
    expect(h.email.sent).toHaveLength(0);
  });

  it("returns duplicate_email when wholesale email already exists", async () => {
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
  });
});
