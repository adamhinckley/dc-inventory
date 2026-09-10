import { CustomerId, OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryBillToRepository } from "../src/adapters/in-memory-bill-to-repository.js";
import { InMemoryContactRepository } from "../src/adapters/in-memory-contact-repository.js";
import { InMemoryCustomerRepository } from "../src/adapters/in-memory-customer-repository.js";
import { InMemoryExemptionCertificateRepository } from "../src/adapters/in-memory-exemption-certificate-repository.js";
import { InMemoryShipToRepository } from "../src/adapters/in-memory-ship-to-repository.js";
import { CreateBillToUseCase } from "../src/application/create-bill-to.js";
import { CreateContactUseCase } from "../src/application/create-contact.js";
import { CreateCustomerUseCase } from "../src/application/create-customer.js";
import { CreateExemptionCertificateUseCase } from "../src/application/create-exemption-certificate.js";
import { CreateShipToUseCase } from "../src/application/create-ship-to.js";
import { GetWholesaleAccountDetailUseCase } from "../src/application/get-wholesale-account-detail.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const WHOLESALE_USER_ID = WholesaleUserId.parse("660e8400-e29b-41d4-a716-446655440020");
const DEFAULT_ORG = OrganizationId.DEFAULT;

function harness() {
  const customers = new InMemoryCustomerRepository();
  const shipTos = new InMemoryShipToRepository();
  const billTos = new InMemoryBillToRepository();
  const contacts = new InMemoryContactRepository();
  const exemptions = new InMemoryExemptionCertificateRepository();
  return {
    customers,
    createCustomer: new CreateCustomerUseCase(customers),
    createShipTo: new CreateShipToUseCase(customers, shipTos),
    createBillTo: new CreateBillToUseCase(customers, billTos),
    createContact: new CreateContactUseCase(customers, contacts),
    createExemption: new CreateExemptionCertificateUseCase(customers, exemptions),
    getWholesaleAccountDetail: new GetWholesaleAccountDetailUseCase(
      customers,
      shipTos,
      billTos,
      contacts,
      exemptions,
    ),
  };
}

describe("GetWholesaleAccountDetailUseCase", () => {
  it("returns not_found when customer is missing", async () => {
    const h = harness();
    const result = await h.getWholesaleAccountDetail.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CustomerId.parse("00000000-0000-4000-8000-000000000099"),
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("bundles account and child rows after one customer read", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Wholesale",
      creditLimitCents: 50_000,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected customer");
    }

    await h.createShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "100 Ship Lane",
      city: "Salt Lake City",
      region: "UT",
      postal: "84101",
      country: "US",
    });
    await h.createBillTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "500 Billing Blvd",
      city: "Salt Lake City",
      region: "UT",
      postal: "84102",
      country: "US",
    });
    await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      name: "Buyer Contact",
      email: "buyer@local.test",
    });
    await h.createExemption.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      jurisdiction: "UT",
      status: "active",
      objectKey: "certs/ut-resale.pdf",
      expiresAt: null,
    });

    const result = await h.getWholesaleAccountDetail.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: created.customer.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.account).toEqual(created.customer);
    expect(result.shipTos).toHaveLength(1);
    expect(result.shipTos[0]).toMatchObject({ line1: "100 Ship Lane" });
    expect(result.billTo).toMatchObject({ line1: "500 Billing Blvd" });
    expect(result.contacts).toEqual([
      expect.objectContaining({ name: "Buyer Contact", email: "buyer@local.test" }),
    ]);
    expect(result.certificates).toEqual([
      expect.objectContaining({ jurisdiction: "UT", objectKey: "certs/ut-resale.pdf" }),
    ]);
  });

  it("returns billTo null when customer has no bill-to", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "No Bill-To Co",
      creditLimitCents: 0,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected customer");
    }

    const result = await h.getWholesaleAccountDetail.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: created.customer.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.billTo).toBeNull();
    expect(result.shipTos).toEqual([]);
    expect(result.contacts).toEqual([]);
    expect(result.certificates).toEqual([]);
  });
});
