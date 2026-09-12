import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  InMemoryBillToRepository,
  InMemoryContactRepository,
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemorySessionStore,
  InMemorySetPasswordTokenStore,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCustomerOccupancyReadPort } from "../adapters/customer-occupancy-read-port.js";
import { DeleteCustomerWithDependentsUseCase } from "./delete-customer-with-dependents.js";

const ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");

async function harness() {
  const customers = new InMemoryCustomerRepository();
  const contacts = new InMemoryContactRepository();
  const shipTos = new InMemoryShipToRepository();
  const billTos = new InMemoryBillToRepository();
  const certificates = new InMemoryExemptionCertificateRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const setPasswordTokens = new InMemorySetPasswordTokenStore();
  const occupancy = new InMemoryCustomerOccupancyReadPort();
  const createCustomer = new CreateCustomerUseCase(customers);
  const deleteCustomer = new DeleteCustomerUseCase(
    customers,
    contacts,
    shipTos,
    billTos,
    certificates,
  );
  const useCase = new DeleteCustomerWithDependentsUseCase(
    customers,
    occupancy,
    wholesaleUsers,
    sessions,
    setPasswordTokens,
    deleteCustomer,
  );
  return {
    customers,
    wholesaleUsers,
    sessions,
    setPasswordTokens,
    occupancy,
    createCustomer,
    useCase,
  };
}

describe("DeleteCustomerWithDependentsUseCase", () => {
  it("removes wholesale users and sessions for an empty customer", async () => {
    const h = await harness();
    const created = await h.createCustomer.execute({
      organizationId: ORG,
      staffUserId: STAFF_ID,
      name: "Harbor Supply",
      creditLimitCents: 0,
      currency: "USD",
      terms: "Net 30",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected create");
    }

    const wholesaleId = WholesaleUserId.parse("660e8400-e29b-41d4-a716-446655440020");
    await h.wholesaleUsers.save({
      id: wholesaleId,
      organizationId: ORG,
      displayName: "Buyer",
      email: "buyer@harbor.test",
      passwordHash: "hash",
      customerId: created.customer.id,
    });
    const invite = await h.setPasswordTokens.mint({
      audience: "wholesale",
      userId: wholesaleId,
      expiresAt: new Date("2026-09-19T00:00:00.000Z"),
    });
    const session = await h.sessions.create({
      audience: "wholesale",
      organizationId: ORG,
      staffUserId: null,
      platformUserId: null,
      wholesaleUserId: wholesaleId,
      opsUserId: null,
      customerId: created.customer.id,
      createdAt: new Date("2026-09-12T00:00:00.000Z"),
      lastSeenAt: new Date("2026-09-12T00:00:00.000Z"),
    });

    expect(
      await h.useCase.execute({ organizationId: ORG, customerId: created.customer.id }),
    ).toEqual({ ok: true });
    expect(await h.customers.findById(ORG, created.customer.id)).toBeNull();
    expect(await h.wholesaleUsers.findById(wholesaleId)).toBeNull();
    expect(await h.sessions.findById(session.id)).toBeNull();
    expect(
      await h.setPasswordTokens.findValid({
        rawToken: invite.rawToken,
        expectedAudience: "wholesale",
        now: new Date("2026-09-12T00:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("refuses customers with occupancy", async () => {
    const h = await harness();
    const created = await h.createCustomer.execute({
      organizationId: ORG,
      staffUserId: STAFF_ID,
      name: "Busy Harbor",
      creditLimitCents: 0,
      currency: "USD",
      terms: "Net 30",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected create");
    }
    h.occupancy.markOccupied(ORG, created.customer.id);
    expect(
      await h.useCase.execute({ organizationId: ORG, customerId: created.customer.id }),
    ).toEqual({ ok: false, reason: "customer_not_empty" });
    expect(await h.customers.findById(ORG, created.customer.id)).not.toBeNull();
  });
});
